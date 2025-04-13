const { body } = require('express-validator');

const whatsAppCredentialsValidators = [
    body('access_token')
        .trim()
        .notEmpty().withMessage('Access Token is required.')
        .isString().withMessage('Access Token must be a string.')
        .isLength({ min: 100 }).withMessage('Access Token appears too short.'), // Basic length check
    
    body('phone_number_id')
        .trim()
        .notEmpty().withMessage('Phone Number ID is required.')
        .isString().withMessage('Phone Number ID must be a string.')
        .isNumeric().withMessage('Phone Number ID must contain only numbers.')
        .isLength({ min: 10 }).withMessage('Phone Number ID appears too short.') // Basic length check
];

module.exports = {
    whatsAppCredentialsValidators
}; 