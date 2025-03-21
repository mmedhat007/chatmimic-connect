import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getGoogleAuthStatus } from './googleSheets';
import { startWhatsAppGoogleSheetsIntegration } from './whatsappGoogleIntegration';
import { startLifecycleTaggingIntegration } from './lifecycleTagging';

/**
 * Initializes the WhatsApp integrations when a user is authenticated
 * This is called when the app starts to ensure integrations are running for logged-in users
 */
export const initializeServices = () => {
  // Set up auth state change listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        // Start the Lifecycle Tagging integration
        console.log('Starting Lifecycle Tagging integration for authenticated user');
        startLifecycleTaggingIntegration().catch(error => {
          console.error('Error starting Lifecycle Tagging integration:', error);
        });
        
        // Check if the user has authorized Google Sheets
        const isAuthorized = await getGoogleAuthStatus();
        
        if (isAuthorized) {
          console.log('Starting WhatsApp Google Sheets integration for authenticated user');
          
          // Start the WhatsApp Google Sheets integration
          startWhatsAppGoogleSheetsIntegration().catch(error => {
            console.error('Error starting Google Sheets integration:', error);
          });
        }
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    }
  });
};

export default initializeServices; 