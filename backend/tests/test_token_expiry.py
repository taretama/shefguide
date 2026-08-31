"""Evidence for the claim in Section 3.6 and Table 5.1 that JWT tokens are
rejected once they expire.

Tokens are forged here with a deliberately past `exp` claim, signed with the
same secret the application uses, so the only reason they can fail validation
is the expiry itself.
"""
from datetime import datetime, timedelta

import pytest
from jose import jwt

import auth


def forge(user_id: str, expires_in_hours: float, guest: bool = False) -> str:
    """A structurally valid token with an expiry we control."""
    payload = {
        "sub": user_id,
        "guest": guest,
        "exp": datetime.utcnow() + timedelta(hours=expires_in_hours),
    }
    return jwt.encode(payload, auth.SECRET, algorithm="HS256")


USER_ID = "000000000000000000000000"


class TestExpiry:
    def test_expired_token_is_rejected(self):
        assert auth.decode_token(forge(USER_ID, expires_in_hours=-1)) is None

    def test_token_expired_by_one_second_is_rejected(self):
        # Boundary case: expiry is enforced, not approximated.
        assert auth.decode_token(forge(USER_ID, expires_in_hours=-1 / 3600)) is None

    def test_unexpired_token_is_accepted(self):
        # Control. Without this, the two tests above would also pass if
        # decode_token rejected every token it was ever given.
        assert auth.decode_token(forge(USER_ID, expires_in_hours=1)) == USER_ID


class TestIssuedTokenLifetimes:
    def test_registered_user_token_lasts_24_hours(self):
        claims = jwt.decode(auth.make_token(USER_ID), auth.SECRET, algorithms=["HS256"])
        lifetime = datetime.utcfromtimestamp(claims["exp"]) - datetime.utcnow()
        assert timedelta(hours=23, minutes=59) < lifetime <= timedelta(hours=24)

    def test_guest_token_lasts_6_hours(self):
        claims = jwt.decode(
            auth.make_token(USER_ID, guest=True), auth.SECRET, algorithms=["HS256"]
        )
        lifetime = datetime.utcfromtimestamp(claims["exp"]) - datetime.utcnow()
        assert timedelta(hours=5, minutes=59) < lifetime <= timedelta(hours=6)


class TestTamperResistance:
    def test_token_signed_with_a_different_secret_is_rejected(self):
        payload = {
            "sub": USER_ID,
            "guest": False,
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        forged = jwt.encode(payload, "an-attackers-guess", algorithm="HS256")
        assert auth.decode_token(forged) is None

    def test_expired_token_is_rejected_at_the_endpoint_guard(self):
        """get_user() is what every protected route calls, so the rejection
        has to happen there and not only inside decode_token()."""
        import main

        expired = forge(USER_ID, expires_in_hours=-1)
        with pytest.raises(main.HTTPException) as excinfo:
            main.get_user(authorization=f"Bearer {expired}")
        assert excinfo.value.status_code == 401
