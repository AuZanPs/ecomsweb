import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';

// Integration test for complete auth flow: registration -> login -> profile access
describe('Auth Flow Integration Tests', () => {

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe('Complete Auth Flow', () => {
    it('should complete registration -> login -> profile access flow', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(registerResponse.body).toHaveProperty('accessToken');
      expect(registerResponse.body).toHaveProperty('refreshToken');
      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body.user).toHaveProperty('email', userData.email);
      expect(registerResponse.body.user).toHaveProperty('name', userData.name);
      expect(registerResponse.body.user).not.toHaveProperty('password');

      // Step 2: Login with registered credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body).toHaveProperty('refreshToken');
      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body.user).toHaveProperty('email', userData.email);
      expect(typeof loginResponse.body.accessToken).toBe('string');

      const token = loginResponse.body.accessToken;

      // Step 3: Access protected profile endpoint
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body).toHaveProperty('email', userData.email);
      expect(profileResponse.body).toHaveProperty('name', userData.name);
      expect(profileResponse.body).toHaveProperty('id');
      expect(profileResponse.body).toHaveProperty('createdAt');
      expect(profileResponse.body).not.toHaveProperty('password');

      // Step 4: Verify token remains valid for subsequent requests
      const secondProfileRequest = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(secondProfileRequest.body).toHaveProperty('email', userData.email);
    });

    it('should prevent login with incorrect password after registration', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // Register user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Attempt login with wrong password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: 'wrongPassword123!'
        })
        .expect(401);

      expect(loginResponse.body).toHaveProperty('message');
      expect(loginResponse.body.message).toContain('Invalid credentials');
    });

    it('should prevent duplicate registration with same email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Attempt duplicate registration
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Another User',
          email: userData.email, // Same email
          password: 'differentPassword123!'
        })
        .expect(400);

      expect(duplicateResponse.body).toHaveProperty('message');
      expect(duplicateResponse.body.message).toContain('Email already registered');
    });

    it('should reject profile access with invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(profileResponse.body).toHaveProperty('message');
      expect(profileResponse.body.message).toContain('Invalid token');
    });

    it('should reject profile access with expired token', async () => {
      // This would require a token that's actually expired
      // In real implementation, you'd generate an expired token for testing
      const expiredToken = 'expired.jwt.token';

      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(profileResponse.body).toHaveProperty('message');
      expect(profileResponse.body.message).toContain('Token expired');
    });

    it('should handle logout and invalidate token', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const token = loginResponse.body.token;

      // Verify token works before logout
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(logoutResponse.body).toHaveProperty('message', 'Logged out successfully');

      // Verify token is invalidated after logout
      const profileAfterLogout = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(profileAfterLogout.body).toHaveProperty('message');
      expect(profileAfterLogout.body.message).toContain('unauthorized');
    });

    it('should maintain session consistency across multiple requests', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // Register and login
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: userData.email,
          password: userData.password
        })
        .expect(200);

      const token = loginResponse.body.token;
      const userId = loginResponse.body.user._id;

      // Make multiple profile requests and verify consistency
      for (let i = 0; i < 3; i++) {
        const profileResponse = await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);

        expect(profileResponse.body.user).toHaveProperty('_id', userId);
        expect(profileResponse.body.user).toHaveProperty('email', userData.email);
        expect(profileResponse.body.user).toHaveProperty('name', userData.name);
      }
    });

    it('should validate password strength during registration', async () => {
      const weakPasswordData = {
        name: 'Test User',
        email: 'test@example.com',
        password: '123' // Weak password
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(registerResponse.body).toHaveProperty('message');
      expect(registerResponse.body.message).toContain('Password must be at least');
    });

    it('should validate email format during registration', async () => {
      const invalidEmailData = {
        name: 'Test User',
        email: 'invalid-email-format',
        password: 'securePassword123!'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(registerResponse.body).toHaveProperty('message');
      expect(registerResponse.body.message).toContain('Invalid email format');
    });

    it('should handle concurrent registration attempts with same email', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'securePassword123!'
      };

      // Simulate concurrent registration attempts
      const promises = [
        request(app).post('/api/auth/register').send(userData),
        request(app).post('/api/auth/register').send({
          ...userData,
          name: 'Another User'
        })
      ];

      const results = await Promise.allSettled(promises);
      
      // One should succeed, one should fail
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
      const failureCount = results.filter(r => r.status === 'fulfilled' && r.value.status === 400).length;
      
      expect(successCount).toBe(1);
      expect(failureCount).toBe(1);
    });
  });

  describe('Auth Flow Edge Cases', () => {
    it('should handle malformed authorization header', async () => {
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidHeaderFormat')
        .expect(401);

      expect(profileResponse.body).toHaveProperty('message');
      expect(profileResponse.body.message).toContain('Invalid authorization header');
    });

    it('should handle missing authorization header', async () => {
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(profileResponse.body).toHaveProperty('message');
      expect(profileResponse.body.message).toContain('Authorization header required');
    });

    it('should handle extremely long passwords during registration', async () => {
      const longPasswordData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'a'.repeat(1000) // Very long password
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(longPasswordData)
        .expect(400);

      expect(registerResponse.body).toHaveProperty('message');
      expect(registerResponse.body.message).toContain('Password too long');
    });

    it('should handle registration with missing required fields', async () => {
      const incompleteData = {
        email: 'test@example.com'
        // Missing name and password
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(registerResponse.body).toHaveProperty('message');
      expect(registerResponse.body.message).toContain('required');
    });

    it('should handle login with non-existent email', async () => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'anyPassword123!'
        })
        .expect(401);

      expect(loginResponse.body).toHaveProperty('message');
      expect(loginResponse.body.message).toContain('Invalid credentials');
    });
  });
});