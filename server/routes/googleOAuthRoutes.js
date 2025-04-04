/**
 * Exchange token route - converts auth code to tokens
 */
router.post('/exchange-token', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }
    
    logger.info('Exchanging Google auth code for tokens');
    
    // Exchange code for tokens
    const tokens = await googleService.exchangeCodeForTokens(code);
    
    if (!tokens || !tokens.access_token) {
      throw new Error('Failed to obtain access token');
    }
    
    // Get user ID from auth header if available
    let userId = null;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const idToken = authHeader.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userId = decodedToken.uid;
      } catch (error) {
        logger.warn('Invalid Firebase token in auth header', error);
        // Continue without user ID - will create anonymous record
      }
    }
    
    // Store tokens in database
    if (userId) {
      await googleService.updateCredentialsInDb(userId, tokens);
      logger.info(`Google credentials saved for user ${userId}`);
    } else {
      logger.warn('No user ID available, tokens not saved to database');
    }
    
    // Return tokens to client - access_token will be needed for API calls
    // Note: refresh_token should not be exposed in production environments
    res.json({
      access_token: tokens.access_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type || 'Bearer',
      scope: tokens.scope,
      refresh_token: tokens.refresh_token,  // Consider excluding in production
    });
  } catch (error) {
    logger.error('Error exchanging token:', error);
    res.status(500).json({ error: `Error refreshing token: ${error.message}` });
  }
});

/**
 * Refresh token route
 */
router.post('/refresh-token', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    logger.info(`Refreshing Google token for user ${userId}`);
    
    // Get fresh credentials, which handles refresh if needed
    const credentials = await googleService.getValidCredentials(userId);
    
    if (!credentials || !credentials.access_token) {
      return res.status(401).json({ error: 'Google credentials not available' });
    }
    
    res.json({
      access_token: credentials.access_token,
      expires_in: credentials.expires_in,
      token_type: credentials.token_type || 'Bearer',
      scope: credentials.scope
    });
  } catch (error) {
    logger.error(`Error refreshing token: ${error.message}`, error);
    res.status(500).json({ error: `Failed to refresh token: ${error.message}` });
  }
}); 