import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getGoogleAuthStatus } from './googleSheets';
import { startLifecycleTaggingIntegration } from './lifecycleTagging';

/**
 * Initializes background services (like lifecycle tagging) when a user is authenticated.
 * This is called when the app starts.
 * NOTE: Google Sheets integration now runs on the backend and does not need frontend initialization here.
 */
export const initializeServices = () => {
  // Set up auth state change listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Start the Lifecycle Tagging integration
        console.log('[Initializer] Starting Lifecycle Tagging integration for authenticated user');
        startLifecycleTaggingIntegration().catch(error => {
          console.error('[Initializer] Error starting Lifecycle Tagging integration:', error);
        });
        
        // REMOVED: Google Sheets integration check and startup - Handled by backend listener
        // const isAuthorized = await getGoogleAuthStatus();
        // if (isAuthorized) {
        //   console.log('[Initializer] Starting WhatsApp Google Sheets integration for authenticated user');
        //   startWhatsAppGoogleSheetsIntegration().catch(error => {
        //     console.error('[Initializer] Error starting Google Sheets integration:', error);
        //   });
        // }

      } catch (error) {
        console.error('[Initializer] Error initializing services:', error);
      }
    } else {
        console.log('[Initializer] User logged out, services depending on auth state should stop if necessary.');
        // Add cleanup logic for other services if needed on logout
    }
  });
};

export default initializeServices; 