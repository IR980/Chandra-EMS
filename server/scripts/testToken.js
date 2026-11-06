
import 'dotenv/config';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../utils/token.util.js';

const testTokens = () => {
  try {
    const testUser = {
      _id: '690000000000000000000001',
      role: '690000000000000000000002',
    };

    const accessToken = generateAccessToken(testUser);

    const refreshResult = generateRefreshToken(testUser);

    const accessPayload = verifyAccessToken(accessToken);
    const refreshPayload = verifyRefreshToken(
      refreshResult.token
    );

    console.log('Access token generated:', Boolean(accessToken));
    console.log('Access token subject:', accessPayload.sub);

    console.log(
      'Refresh token generated:',
      Boolean(refreshResult.token)
    );

    console.log(
      'Refresh token ID:',
      refreshPayload.jti === refreshResult.tokenId
    );

    console.log('\nJWT utility test passed!');
  } catch (error) {
    console.error('JWT test failed:', error.message);
    process.exitCode = 1;
  }
};

testTokens();
