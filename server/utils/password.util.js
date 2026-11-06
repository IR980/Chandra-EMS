import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Validate password strength.
 * Minimum 8 characters, uppercase, lowercase,
 * number and special character.
 */
export const validatePassword = (password) => {
  if (typeof password !== "string") {
    return {
      valid: false,
      message: "Password must be a string.",
    };
  }

  if (password.length < 8 || password.length > 128) {
    return {
      valid: false,
      message: "Password must contain 8 to 128 characters.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain an uppercase letter.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain a lowercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain a number.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must contain a special character.",
    };
  }

  return {
    valid: true,
    message: "Password is strong.",
  };
};

/**
 * Hash a plain-text password.
 */
export const hashPassword = async (password) => {
  const validation = validatePassword(password);

  if (!validation.valid) {
    throw new Error(validation.message);
  }

  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare entered password with stored hash.
 */
export const comparePassword = async (enteredPassword, storedHash) => {
  if (
    typeof enteredPassword !== "string" ||
    typeof storedHash !== "string" ||
    !storedHash
  ) {
    return false;
  }

  return await bcrypt.compare(enteredPassword, storedHash);
};
