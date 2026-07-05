from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.exceptions import AppException
from app.db.database import get_db
from app.integrations.toss import TossPaymentError, TossPaymentsClient
from app.models.enums import PlanId
from app.models.payment import Payment
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.subscription import BillingCycle, ConfirmPaymentRequest, SubscribeRequest, SubscriptionResponse

router = APIRouter(prefix="/subscription", tags=["subscription"])

PLAN_CATALOG = {
    PlanId.FREE: {
        "name": "무료",
        "monthly": 0,
        "yearly": 0,
    },
    PlanId.PRO: {
        "name": "프로",
        "monthly": 19900,
        "yearly": 15900 * 12,
    },
    PlanId.TEAM: {
        "name": "팀",
        "monthly": 49900,
        "yearly": 39900 * 12,
    },
}


def _next_billing_at(updated_at: datetime, plan_id: PlanId, billing: BillingCycle) -> datetime | None:
    if plan_id == PlanId.FREE:
        return None
    return updated_at + timedelta(days=365 if billing == BillingCycle.YEARLY else 30)


def _subscription_response(plan_id: str, billing: str, updated_at: datetime) -> SubscriptionResponse:
    normalized_plan = PlanId(plan_id)
    normalized_billing = BillingCycle(billing)
    plan = PLAN_CATALOG[normalized_plan]
    amount = plan[normalized_billing.value]
    next_billing_at = _next_billing_at(updated_at, normalized_plan, normalized_billing)
    return SubscriptionResponse(
        plan_id=normalized_plan.value,
        billing=normalized_billing.value,
        status="active",
        plan_name=plan["name"],
        amount=amount,
        is_paid=amount > 0,
        current_period_started_at=updated_at,
        current_period_ends_at=next_billing_at,
        next_billing_at=next_billing_at,
        updated_at=updated_at,
    )


@router.get("/checkout/config")
def get_checkout_config() -> dict[str, str | None]:
    # Toss's client key is meant to be used client-side (it's the public half
    # of the key pair) — served from settings so the frontend never needs the
    # value hardcoded in source.
    return {"clientKey": settings.toss_client_key}


@router.get("/plans")
def list_subscription_plans() -> dict[str, object]:
    return {
        "currency": "KRW",
        "plans": [
            {
                "id": plan_id.value,
                "name": plan["name"],
                "price": {
                    "monthly": plan["monthly"],
                    "yearly": plan["yearly"],
                },
            }
            for plan_id, plan in PLAN_CATALOG.items()
        ],
    }


@router.get("/me", response_model=SubscriptionResponse)
def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    sub = db.scalar(select(Subscription).where(Subscription.user_id == current_user.id))
    if sub is None:
        return _subscription_response("free", "monthly", current_user.created_at)
    return _subscription_response(sub.plan_id, sub.billing, sub.updated_at)


@router.post("/subscribe", response_model=SubscriptionResponse)
def subscribe(
    payload: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    sub = db.scalar(select(Subscription).where(Subscription.user_id == current_user.id))
    if sub is None:
        sub = Subscription(
            user_id=current_user.id,
            plan_id=payload.plan_id.value,
            billing=payload.billing.value,
        )
        db.add(sub)
    else:
        sub.plan_id = payload.plan_id.value
        sub.billing = payload.billing.value
    db.commit()
    db.refresh(sub)
    return _subscription_response(sub.plan_id, sub.billing, sub.updated_at)


@router.post("/checkout/confirm", response_model=SubscriptionResponse)
def confirm_checkout_payment(
    payload: ConfirmPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    # Cross-check against our own price catalog rather than trusting the
    # client outright — otherwise a tampered request could confirm a cheap
    # payment key while claiming a higher-tier plan. Coupons (up to 20% off,
    # see frontend/src/data/subscriptionPlans.js COUPON_CODES) aren't tracked
    # server-side yet, so allow that range rather than requiring an exact
    # match; Toss's own confirm call is still the actual source of truth for
    # what was charged.
    plan = PLAN_CATALOG[payload.plan_id]
    expected_amount = plan[payload.billing.value]
    min_allowed_amount = int(expected_amount * 0.8)
    if expected_amount > 0 and not (min_allowed_amount <= payload.amount <= expected_amount):
        raise AppException(
            detail="결제 금액이 요금제 가격과 일치하지 않습니다.",
            status_code=400,
            code="amount_mismatch",
        )

    existing = db.scalar(select(Payment).where(Payment.toss_order_id == payload.order_id))
    if existing is not None:
        # Already confirmed (e.g. a duplicate success-page load) — return the
        # current subscription state instead of re-confirming with Toss.
        sub = db.scalar(select(Subscription).where(Subscription.user_id == current_user.id))
        if sub is not None:
            return _subscription_response(sub.plan_id, sub.billing, sub.updated_at)

    try:
        client = TossPaymentsClient()
        result = client.confirm_payment(payload.payment_key, payload.order_id, payload.amount)
    except TossPaymentError as exc:
        raise AppException(detail=exc.message, status_code=400, code=f"toss_{exc.code.lower()}") from exc
    except RuntimeError as exc:
        raise AppException(detail=str(exc), status_code=500, code="toss_not_configured") from exc

    db.add(
        Payment(
            user_id=current_user.id,
            plan_id=payload.plan_id.value,
            billing=payload.billing.value,
            amount=result.total_amount,
            status=result.status,
            toss_order_id=result.order_id,
            toss_payment_key=result.payment_key,
            method=result.method,
            receipt_url=result.receipt_url,
        )
    )

    sub = db.scalar(select(Subscription).where(Subscription.user_id == current_user.id))
    if sub is None:
        sub = Subscription(
            user_id=current_user.id,
            plan_id=payload.plan_id.value,
            billing=payload.billing.value,
        )
        db.add(sub)
    else:
        sub.plan_id = payload.plan_id.value
        sub.billing = payload.billing.value
    db.commit()
    db.refresh(sub)
    return _subscription_response(sub.plan_id, sub.billing, sub.updated_at)
