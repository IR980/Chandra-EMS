
import {
  hashPassword,
  comparePassword,
  validatePassword,
} from '../utils/password.util.js';

const testPassword = async () => {
  try {
    const password = 'Chandra@2026';

    console.log('Password validation:');

    const validation = validatePassword(password);
    console.log(validation);

    const hashedPassword = await hashPassword(password);

    console.log('\nPassword hashed successfully.');

    const correctPassword = await comparePassword(
      password,
      hashedPassword
    );

    const incorrectPassword = await comparePassword(
      'WrongPassword@2026',
      hashedPassword
    );

    console.log('Correct password:', correctPassword);
    console.log('Incorrect password:', incorrectPassword);

    if (!correctPassword || incorrectPassword) {
      throw new Error('Password utility test failed.');
    }

    console.log('\nPassword utility test passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exitCode = 1;
  }
};

testPassword();
