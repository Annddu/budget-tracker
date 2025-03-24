const { getTransactionsHistory } = require('../app/api/transactions-history/route');
const { prisma } = require('@/lib/prisma');
const { GetFormatterForCurrency } = require('@/lib/helpers');

// Mock dependencies
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userSettings: {
      findUnique: jest.fn()
    },
    transation: { // Changed back to 'transation' to match the actual code
      findMany: jest.fn()
    }
  }
}));

jest.mock('@/lib/helpers', () => ({
  GetFormatterForCurrency: jest.fn()
}));

describe('getTransactionsHistory', () => {
  const userId = 'user123';
  const from = new Date('2023-01-01');
  const to = new Date('2023-01-31');
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should filter transactions by date range', async () => {
    // Arrange
    const mockSettings = { userId, currency: 'USD' };
    const mockFormatter = { format: function(amount: any) { return `$${amount}`; } }; // Fixed TypeScript syntax
    const mockTransactions = [
      { 
        id: '1', 
        amount: 100, 
        date: new Date('2023-01-15'),
        type: 'expense', 
        description: 'Test expense',
        category: 'Food',
        categoryIcon: '🍔',
        userId: userId
      },
      { 
        id: '2', 
        amount: 200, 
        date: new Date('2023-01-20'),
        type: 'income', 
        description: 'Test income',
        category: 'Salary',
        categoryIcon: '💰',
        userId: userId
      }
    ];

    prisma.userSettings.findUnique.mockResolvedValue(mockSettings);
    GetFormatterForCurrency.mockReturnValue(mockFormatter);
    prisma.transation.findMany.mockResolvedValue(mockTransactions); // Changed to match actual code

    // Act
    const result = await getTransactionsHistory(userId, from, to);

    // Assert
    expect(prisma.transation.findMany).toHaveBeenCalledWith({ // Changed to match actual code
      where: {
        userId,
        date: { gte: from, lte: to }
      },
      orderBy: { date: 'desc' }
    });
    
    expect(result).toHaveLength(2);
    expect(result[0].formattedAmount).toBe('$100');
    expect(result[1].formattedAmount).toBe('$200');
  });
});