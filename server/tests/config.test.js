/**
 * Tests for the configuration API endpoints
 */

const request = require('supertest');
const express = require('express');
const app = require('../index');
const { saveUserConfig, fetchUserConfig } = require('../services/supabaseService');

// Mock middleware
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: 'test-user-id' };
    next();
  }
}));

// Mock services
jest.mock('../services/supabaseService', () => ({
  saveUserConfig: jest.fn(),
  fetchUserConfig: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  logError: jest.fn()
}));

describe('Configuration API Endpoints', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/config', () => {
    it('should save user configuration', async () => {
      // Mock configuration data
      const configData = {
        name: 'Test Configuration',
        behaviorRules: [
          { rule: 'Be helpful', description: 'Provide helpful responses' }
        ],
        isActive: true,
        settings: { temperature: 0.7 }
      };
      
      // Mock response
      const mockResponse = {
        id: 'config-123',
        userId: 'test-user-id',
        ...configData,
        createdAt: '2023-05-15T12:34:56Z',
        updatedAt: '2023-05-15T12:34:56Z'
      };
      
      saveUserConfig.mockResolvedValue(mockResponse);

      const response = await request(app)
        .post('/api/config')
        .send(configData);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockResponse);
      expect(saveUserConfig).toHaveBeenCalledWith('test-user-id', configData);
    });

    it('should return validation error for invalid configuration', async () => {
      // Invalid configuration missing name
      const invalidConfig = {
        behaviorRules: [
          { rule: 'Be helpful', description: 'Provide helpful responses' }
        ],
        isActive: true
      };

      const response = await request(app)
        .post('/api/config')
        .send(invalidConfig);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('validation failed');
      expect(saveUserConfig).not.toHaveBeenCalled();
    });

    it('should return error when saving fails', async () => {
      // Mock error
      const mockError = new Error('Database Error');
      saveUserConfig.mockRejectedValue(mockError);

      // Valid configuration
      const configData = {
        name: 'Test Configuration',
        behaviorRules: [
          { rule: 'Be helpful', description: 'Provide helpful responses' }
        ],
        isActive: true
      };

      const response = await request(app)
        .post('/api/config')
        .send(configData);

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Database Error');
    });
  });

  describe('GET /api/config', () => {
    it('should fetch user configuration', async () => {
      // Mock configuration response
      const mockConfig = {
        id: 'config-123',
        userId: 'test-user-id',
        name: 'Test Configuration',
        behaviorRules: [
          { rule: 'Be helpful', description: 'Provide helpful responses' }
        ],
        isActive: true,
        settings: { temperature: 0.7 },
        createdAt: '2023-05-15T12:34:56Z',
        updatedAt: '2023-05-15T12:34:56Z'
      };
      
      fetchUserConfig.mockResolvedValue(mockConfig);

      const response = await request(app)
        .get('/api/config');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockConfig);
      expect(fetchUserConfig).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 404 when configuration not found', async () => {
      // Mock null response (not found)
      fetchUserConfig.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/config');

      expect(response.status).toBe(404);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Configuration not found');
    });

    it('should return error when fetching fails', async () => {
      // Mock error
      const mockError = new Error('Database Error');
      fetchUserConfig.mockRejectedValue(mockError);

      const response = await request(app)
        .get('/api/config');

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Database Error');
    });
  });
}); 