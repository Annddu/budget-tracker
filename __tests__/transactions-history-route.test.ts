import { GET, getTransactionsHistory } from '../app/api/transactions-history/route';
import { prisma } from '@/lib/prisma';
import { GetFormatterForCurrency } from '@/lib/helpers';
import { auth, currentUser } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import { redirect } from 'next/navigation';

// Add a proper Response mock
const mockResponseJson = jest.fn();
global.Response = {
  json: (data: any, init?: ResponseInit) => ({
    status: init?.status || 200,
    json: async () => data,
    headers: new Headers()
  })
} as any;

jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: {
      findUnique: jest.fn()
    },
    transation: {
      findMany: jest.fn()
    }
  }
}));

jest.mock('@/lib/helpers', () => ({
  GetFormatterForCurrency: jest.fn(),
  DateToUTCDate: jest.fn((date) => date)
}));

// Mock redirect to throw a custom error instead of actually redirecting
jest.mock('next/navigation', () => ({
  redirect: jest.fn().mockImplementation((url) => {
    throw new Error(`REDIRECT: ${url}`);
  })
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  currentUser: jest.fn()
}));

describe('Transactions History API Route', () => {
  describe('GET handler', () => {
    const mockUserId = 'user123';
    const mockTransactions = [
      { 
        id: '1', 
        amount: 100, 
        date: new Date('2023-01-15'),
        type: 'expense', 
        description: 'Test expense',
        category: 'Food',
        categoryIcon: '🍔',
        userId: mockUserId
      }
    ];
    const mockSettings = { currency: 'USD' };
    const mockFormatter = { format: (amount: number) => `$${amount}` };

    beforeEach(() => {
      jest.clearAllMocks();
      (auth as unknown as jest.Mock).mockReturnValue({ userId: mockUserId });
      (currentUser as unknown as jest.Mock).mockResolvedValue({ id: mockUserId });
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue(mockSettings);
      (GetFormatterForCurrency as jest.Mock).mockReturnValue(mockFormatter);
      (prisma.transation.findMany as jest.Mock).mockResolvedValue(mockTransactions);
    });

    it('should redirect to sign-in if user is not authenticated', async () => {
      (currentUser as unknown as jest.Mock).mockResolvedValue(null);
      
      const mockRequest = {
        url: 'http://localhost:3000/api/transactions-history?from=2023-01-01&to=2023-01-31'
      } as unknown as Request;

      // Test that it redirects to sign-in
      await expect(GET(mockRequest)).rejects.toThrow('REDIRECT: /sign-in');
    });

    it('should return transactions for the given date range', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/transactions-history?from=2023-01-01&to=2023-01-31'
      } as unknown as Request;

      const response = await GET(mockRequest);
      
      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData).toHaveLength(1);
      expect(responseData[0]).toHaveProperty('formattedAmount', '$100');
      
      expect(prisma.transation.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          date: {
            gte: expect.any(Date),
            lte: expect.any(Date)
          }
        },
        orderBy: { date: "desc" }
      });
    });

    it('should handle missing query parameters', async () => {
      const mockRequest = {
        url: 'http://localhost:3000/api/transactions-history'
      } as unknown as Request;

      const response = await GET(mockRequest);
      
      expect(response.status).toBe(200);
      expect(prisma.transation.findMany).toHaveBeenCalled();
    });
  });

  // getTransactionsHistory function tests remain the same
  describe('getTransactionsHistory function', () => {
    it('should handle empty results from database', async () => {
      const userId = 'user123';
      const from = new Date('2023-01-01');
      const to = new Date('2023-01-31');
      
      (prisma.userSettings.findUnique as jest.Mock).mockResolvedValue({ currency: 'USD' });
      (GetFormatterForCurrency as jest.Mock).mockReturnValue({ format: (val: number) => `$${val}` });
      (prisma.transation.findMany as jest.Mock).mockResolvedValue([]);
      
      const result = await getTransactionsHistory(userId, from, to);
      
      expect(result).toEqual([]);
      expect(prisma.transation.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          date: { gte: from, lte: to }
        },
        orderBy: { date: 'desc' }
      });
    });
  });
});