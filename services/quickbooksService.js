// Try to import node-quickbooks, but make it optional
let QuickBooks;
try {
  QuickBooks = require('node-quickbooks');
} catch (error) {
  console.warn('node-quickbooks not installed. QuickBooks integration will be disabled.');
  QuickBooks = null;
}

class QuickBooksService {
  constructor() {
    this.qbo = null;
    this.isConnected = false;
  }

  async initialize() {
    try {
      if (!QuickBooks) {
        console.warn('QuickBooks not available. QuickBooks integration disabled.');
        return;
      }

      // Initialize QuickBooks connection
      this.qbo = new QuickBooks(
        process.env.QUICKBOOKS_CLIENT_ID,
        process.env.QUICKBOOKS_CLIENT_SECRET,
        process.env.QUICKBOOKS_ACCESS_TOKEN,
        false, // no debug
        process.env.QUICKBOOKS_REALM_ID
      );

      this.isConnected = true;
      console.log('QuickBooks service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize QuickBooks service:', error);
      throw error;
    }
  }

  // Create customer in QuickBooks
  async createCustomer(customerData) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      const customer = {
        Name: customerData.name,
        PrimaryEmailAddr: {
          Address: customerData.email
        },
        PrimaryPhone: {
          FreeFormNumber: customerData.phone
        },
        BillAddr: {
          Line1: customerData.address?.street || '',
          City: customerData.address?.city || '',
          CountrySubDivisionCode: customerData.address?.state || '',
          Country: customerData.address?.country || '',
          PostalCode: customerData.address?.zipCode || ''
        }
      };

      return new Promise((resolve, reject) => {
        this.qbo.createCustomer(customer, (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        });
      });
    } catch (error) {
      console.error('Create QuickBooks customer error:', error);
      throw error;
    }
  }

  // Create invoice in QuickBooks
  async createInvoice(invoiceData) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      const invoice = {
        CustomerRef: {
          value: invoiceData.customerId
        },
        Line: invoiceData.items.map(item => ({
          Amount: item.price,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: {
              value: item.quickbooksItemId || '1' // Default item ID
            },
            Qty: 1,
            UnitPrice: item.price
          }
        })),
        DocNumber: invoiceData.invoiceNo,
        DueDate: invoiceData.dueDate,
        PrivateNote: invoiceData.notes || ''
      };

      return new Promise((resolve, reject) => {
        this.qbo.createInvoice(invoice, (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice);
          }
        });
      });
    } catch (error) {
      console.error('Create QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Get customer by ID
  async getCustomer(customerId) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.getCustomer(customerId, (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        });
      });
    } catch (error) {
      console.error('Get QuickBooks customer error:', error);
      throw error;
    }
  }

  // Get invoice by ID
  async getInvoice(invoiceId) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.getInvoice(invoiceId, (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice);
          }
        });
      });
    } catch (error) {
      console.error('Get QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Update customer in QuickBooks
  async updateCustomer(customerId, customerData) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      const customer = {
        Id: customerId,
        Name: customerData.name,
        PrimaryEmailAddr: {
          Address: customerData.email
        },
        PrimaryPhone: {
          FreeFormNumber: customerData.phone
        },
        BillAddr: {
          Line1: customerData.address?.street || '',
          City: customerData.address?.city || '',
          CountrySubDivisionCode: customerData.address?.state || '',
          Country: customerData.address?.country || '',
          PostalCode: customerData.address?.zipCode || ''
        }
      };

      return new Promise((resolve, reject) => {
        this.qbo.updateCustomer(customer, (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        });
      });
    } catch (error) {
      console.error('Update QuickBooks customer error:', error);
      throw error;
    }
  }

  // Update invoice in QuickBooks
  async updateInvoice(invoiceId, invoiceData) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      const invoice = {
        Id: invoiceId,
        CustomerRef: {
          value: invoiceData.customerId
        },
        Line: invoiceData.items.map(item => ({
          Amount: item.price,
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            ItemRef: {
              value: item.quickbooksItemId || '1'
            },
            Qty: 1,
            UnitPrice: item.price
          }
        })),
        DocNumber: invoiceData.invoiceNo,
        DueDate: invoiceData.dueDate,
        PrivateNote: invoiceData.notes || ''
      };

      return new Promise((resolve, reject) => {
        this.qbo.updateInvoice(invoice, (err, invoice) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoice);
          }
        });
      });
    } catch (error) {
      console.error('Update QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Delete customer from QuickBooks
  async deleteCustomer(customerId) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.deleteCustomer(customerId, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error('Delete QuickBooks customer error:', error);
      throw error;
    }
  }

  // Delete invoice from QuickBooks
  async deleteInvoice(invoiceId) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.deleteInvoice(invoiceId, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    } catch (error) {
      console.error('Delete QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Sync customer data
  async syncCustomer(localCustomer) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      // Check if customer exists in QuickBooks
      const existingCustomer = await this.findCustomerByEmail(localCustomer.email);
      
      if (existingCustomer) {
        // Update existing customer
        return await this.updateCustomer(existingCustomer.Id, localCustomer);
      } else {
        // Create new customer
        return await this.createCustomer(localCustomer);
      }
    } catch (error) {
      console.error('Sync QuickBooks customer error:', error);
      throw error;
    }
  }

  // Sync invoice data
  async syncInvoice(localInvoice) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      // Check if invoice exists in QuickBooks
      const existingInvoice = await this.findInvoiceByNumber(localInvoice.invoiceNo);
      
      if (existingInvoice) {
        // Update existing invoice
        return await this.updateInvoice(existingInvoice.Id, localInvoice);
      } else {
        // Create new invoice
        return await this.createInvoice(localInvoice);
      }
    } catch (error) {
      console.error('Sync QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Find customer by email
  async findCustomerByEmail(email) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.findCustomers({
          PrimaryEmailAddr: email
        }, (err, customers) => {
          if (err) {
            reject(err);
          } else {
            resolve(customers.length > 0 ? customers[0] : null);
          }
        });
      });
    } catch (error) {
      console.error('Find QuickBooks customer error:', error);
      throw error;
    }
  }

  // Find invoice by number
  async findInvoiceByNumber(invoiceNumber) {
    try {
      if (!this.isConnected) {
        throw new Error('QuickBooks not connected');
      }

      return new Promise((resolve, reject) => {
        this.qbo.findInvoices({
          DocNumber: invoiceNumber
        }, (err, invoices) => {
          if (err) {
            reject(err);
          } else {
            resolve(invoices.length > 0 ? invoices[0] : null);
          }
        });
      });
    } catch (error) {
      console.error('Find QuickBooks invoice error:', error);
      throw error;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      available: !!QuickBooks
    };
  }

  // Close connection
  close() {
    this.isConnected = false;
    this.qbo = null;
  }
}

module.exports = QuickBooksService; 