from fastapi import HTTPException, status


def api_error(message: str, field: str | None = None, status_code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    """Matches the frontend's `ApiError{message, field}` shape so the same
    try/catch-and-show-the-message pattern keeps working against a real API."""
    return HTTPException(status_code=status_code, detail={"message": message, "field": field})
