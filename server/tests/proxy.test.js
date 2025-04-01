/**
 * Tests for the proxy API endpoints
 */

const request = require('supertest');
const express = require('express');
const app = require('../index');
const { makeRequest } = require('../services/proxyService');
const { generateEmbeddings } = require('../services/aiService');

// Mock middleware
jest.mock('../middleware/auth', () => ({
  requireAuth: (req, res, next) => {
    req.user = { uid: 'test-user-id' };
    next();
  }
}));

// Mock services
jest.mock('../services/proxyService', () => ({
  makeRequest: jest.fn()
}));

jest.mock('../services/aiService', () => ({
  generateEmbeddings: jest.fn(),
  extractDataWithGroq: jest.fn()
}));

jest.mock('../services/supabaseService', () => ({
  saveEmbedding: jest.fn(),
  matchDocuments: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
  logError: jest.fn()
}));

describe('Proxy API Endpoints', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/proxy/proxy', () => {
    it('should proxy requests to approved services', async () => {
      // Mock response data
      const mockResponseData = { result: 'success', data: { foo: 'bar' } };
      makeRequest.mockResolvedValue(mockResponseData);

      const response = await request(app)
        .post('/api/proxy/proxy')
        .send({
          endpoint: 'https://api.example.com/test',
          service: 'openai',
          method: 'POST',
          data: { prompt: 'Hello world' }
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data).toEqual(mockResponseData);
      expect(makeRequest).toHaveBeenCalledWith({
        url: 'https://api.example.com/test',
        method: 'POST',
        data: { prompt: 'Hello world' },
        headers: undefined,
        params: undefined,
        service: 'openai'
      });
    });

    it('should return error when proxy request fails', async () => {
      // Mock error
      const mockError = new Error('API Error');
      mockError.statusCode = 400;
      mockError.details = { reason: 'Bad Request' };
      makeRequest.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/proxy/proxy')
        .send({
          endpoint: 'https://api.example.com/test',
          service: 'openai',
          method: 'POST',
          data: { prompt: 'Hello world' }
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('API Error');
      expect(response.body.details).toEqual({ reason: 'Bad Request' });
    });
  });

  describe('POST /api/proxy/embeddings', () => {
    it('should generate embeddings using OpenAI', async () => {
      // Mock embeddings response
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      generateEmbeddings.mockResolvedValue(mockEmbedding);

      const response = await request(app)
        .post('/api/proxy/embeddings')
        .send({
          text: 'This is a test text for embeddings'
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
      expect(response.body.data.embedding).toEqual(mockEmbedding);
      expect(response.body.data.model).toBe('text-embedding-3-small');
      expect(response.body.data.dimensions).toBe(5);
      expect(generateEmbeddings).toHaveBeenCalledWith('This is a test text for embeddings');
    });

    it('should return error when embeddings generation fails', async () => {
      // Mock error
      const mockError = new Error('OpenAI API Error');
      generateEmbeddings.mockRejectedValue(mockError);

      const response = await request(app)
        .post('/api/proxy/embeddings')
        .send({
          text: 'This is a test text for embeddings'
        });

      expect(response.status).toBe(500);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('OpenAI API Error');
    });
  });
}); 