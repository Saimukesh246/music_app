from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_verify_password_accepts_the_correct_password():
    password_hash, salt = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", password_hash, salt) is True


def test_verify_password_rejects_the_wrong_password():
    password_hash, salt = hash_password("correct horse battery staple")
    assert verify_password("wrong password", password_hash, salt) is False


def test_hash_password_uses_a_different_salt_each_time():
    hash_a, salt_a = hash_password("same password")
    hash_b, salt_b = hash_password("same password")
    assert salt_a != salt_b
    assert hash_a != hash_b


def test_access_token_round_trips_the_user_id():
    token = create_access_token(user_id=42)
    assert decode_access_token(token) == 42


def test_decode_access_token_returns_none_for_a_garbage_token():
    assert decode_access_token("not-a-real-token") is None
