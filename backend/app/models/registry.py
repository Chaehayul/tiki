"""Helpers for registering ORM models with SQLAlchemy."""


def import_all_models() -> None:
    """Import models that participate in string-based relationships."""
    import app.models.analysis  # noqa: F401
    import app.models.file  # noqa: F401
    import app.models.integration  # noqa: F401
    import app.models.project  # noqa: F401
    import app.models.ticket  # noqa: F401
    import app.models.user  # noqa: F401
    import app.models.user_integration  # noqa: F401
    import app.models.user_session  # noqa: F401
    import app.models.subscription  # noqa: F401
    import app.models.payment  # noqa: F401
