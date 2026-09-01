from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..auth import clear_session, current_admin, issue_session, verify_credentials
from ..config import Settings, get_settings
from ..schemas import LoginRequest, SessionOut

router = APIRouter(prefix="/api/admin", tags=["auth"])


@router.post("/login", response_model=SessionOut)
def login(
    payload: LoginRequest,
    response: Response,
    settings: Settings = Depends(get_settings),
) -> SessionOut:
    if not verify_credentials(payload.email, payload.password, settings):
        # One message for both wrong email and wrong password, so the response
        # does not confirm whether an address is the administrator's.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Those details were not recognised")
    issue_session(response, settings.admin_email, settings)
    return SessionOut(email=settings.admin_email)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    clear_session(response)


@router.get("/session", response_model=SessionOut)
def session(email: str = Depends(current_admin)) -> SessionOut:
    return SessionOut(email=email)
