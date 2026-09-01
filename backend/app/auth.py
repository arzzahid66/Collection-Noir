import hmac

from fastapi import Cookie, Depends, HTTPException, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from .config import Settings, get_settings

SESSION_COOKIE = "cn_admin_session"


def _serializer(settings: Settings) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(settings.session_secret, salt="cn-admin")


def verify_credentials(email: str, password: str, settings: Settings) -> bool:
    """Check the single administrator credential.

    compare_digest on both fields so neither comparison leaks length or
    position through timing.
    """
    email_ok = hmac.compare_digest(email.strip().lower(), settings.admin_email.strip().lower())
    password_ok = hmac.compare_digest(password, settings.admin_password)
    return email_ok and password_ok


def issue_session(response: Response, email: str, settings: Settings) -> None:
    token = _serializer(settings).dumps({"email": email})
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=settings.session_max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def current_admin(
    cn_admin_session: str | None = Cookie(default=None, alias=SESSION_COOKIE),
    settings: Settings = Depends(get_settings),
) -> str:
    """Dependency guarding every mutating route.

    Returns the administrator email, or raises 401.
    """
    if not cn_admin_session:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    try:
        payload = _serializer(settings).loads(
            cn_admin_session, max_age=settings.session_max_age
        )
    except SignatureExpired as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired") from exc
    except BadSignature as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session") from exc

    email = payload.get("email")
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session")
    return email
