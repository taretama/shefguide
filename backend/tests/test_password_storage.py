"""Evidence for the claim in Section 3.6 and Table 5.1 that passwords are
never stored in plain text anywhere in the registration or login flow.

The database is mocked rather than live, so what these tests assert is what
the application *hands to* MongoDB. That is the point at which a plaintext
password would leak into storage, so it is the right place to check.
"""
import bcrypt
import pytest

import auth


PLAINTEXT = "Testpass123!"


class TestHashing:
    def test_hash_is_not_the_plaintext(self):
        hashed = auth.hash_password(PLAINTEXT)
        assert hashed != PLAINTEXT
        assert PLAINTEXT not in hashed

    def test_hash_is_bcrypt_with_a_salt(self):
        hashed = auth.hash_password(PLAINTEXT)
        # bcrypt hashes identify their algorithm and cost in the prefix.
        assert hashed.startswith(("$2a$", "$2b$", "$2y$"))
        assert bcrypt.checkpw(PLAINTEXT.encode(), hashed.encode())

    def test_same_password_hashes_differently_each_time(self):
        # A fresh salt per call, so two users with the same password do not
        # end up with matching hashes in the database.
        assert auth.hash_password(PLAINTEXT) != auth.hash_password(PLAINTEXT)

    def test_correct_password_verifies(self):
        assert auth.check_password(PLAINTEXT, auth.hash_password(PLAINTEXT))

    def test_wrong_password_is_rejected(self):
        assert not auth.check_password("WrongPassword1!", auth.hash_password(PLAINTEXT))


class TestRegistrationFlow:
    """What actually reaches the database when a student registers."""

    def test_stored_document_contains_no_plaintext_password(self, monkeypatch):
        import main

        captured = {}

        class FakeUsers:
            def find_one(self, *_args, **_kwargs):
                return None                      # email not already registered

            def insert_one(self, document):
                captured["document"] = document
                class Result:
                    inserted_id = "000000000000000000000000"
                return Result()

        monkeypatch.setattr(main, "users_collection", FakeUsers())

        body = main.RegisterBody(
            email="student@example.ac.uk",
            password=PLAINTEXT,
            university="University of Sheffield",
            home_country="Nigeria",
            programme="MSc Cybersecurity and Artificial Intelligence",
            arrival_date="2026-09-20",
        )
        main.register(body, authorization=None)

        document = captured["document"]

        # The password must not appear under any key, at any nesting depth.
        assert PLAINTEXT not in repr(document)
        assert "password" not in document
        assert document["password_hash"] != PLAINTEXT
        assert auth.check_password(PLAINTEXT, document["password_hash"])

    def test_login_verifies_against_the_stored_hash(self, monkeypatch):
        import main

        stored = {
            "_id": "000000000000000000000000",
            "email": "student@example.ac.uk",
            "password_hash": auth.hash_password(PLAINTEXT),
        }

        class FakeUsers:
            def find_one(self, *_args, **_kwargs):
                return stored

        monkeypatch.setattr(main, "users_collection", FakeUsers())

        result = main.login(main.LoginBody(email=stored["email"], password=PLAINTEXT))
        assert "token" in result

        with pytest.raises(main.HTTPException) as excinfo:
            main.login(main.LoginBody(email=stored["email"], password="WrongPassword1!"))
        assert excinfo.value.status_code == 401
