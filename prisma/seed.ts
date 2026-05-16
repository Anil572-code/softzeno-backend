import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

type UserRoleName =
  | 'Owner'
  | 'Admin'
  | 'Manager'
  | 'Cashier'
  | 'Waiter'
  | 'Kitchen';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing.');
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

const BUSINESS_ID = 'softzeno-demo-business';

const permissionModules = [
  'Dashboard',
  'POS / Billing',
  'Orders',
  'Tables',
  'Menu',
  'Inventory',
  'Ledger',
  'Payments',
  'Reports',
  'Settings',
];

function permissionsForRole(role: UserRoleName) {
  return permissionModules.map((module) => {
    if (role === 'Owner') {
      return {
        module,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
        canApprove: true,
      };
    }

    if (role === 'Admin') {
      return {
        module,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: module !== 'POS / Billing',
        canExport: true,
        canApprove: true,
      };
    }

    if (role === 'Manager') {
      return {
        module,
        canView: true,
        canCreate: module !== 'Settings',
        canEdit: module !== 'Settings',
        canDelete: false,
        canExport: module !== 'Settings',
        canApprove: module !== 'Settings',
      };
    }

    if (role === 'Cashier') {
      const allowed = [
        'Dashboard',
        'POS / Billing',
        'Orders',
        'Tables',
        'Ledger',
        'Payments',
      ];

      return {
        module,
        canView: allowed.includes(module),
        canCreate: ['POS / Billing', 'Orders', 'Ledger', 'Payments'].includes(
          module,
        ),
        canEdit: ['Orders', 'Ledger', 'Payments'].includes(module),
        canDelete: false,
        canExport: false,
        canApprove: false,
      };
    }

    if (role === 'Waiter') {
      return {
        module,
        canView: ['Orders', 'Tables', 'Menu'].includes(module),
        canCreate: module === 'Orders',
        canEdit: ['Orders', 'Tables'].includes(module),
        canDelete: false,
        canExport: false,
        canApprove: false,
      };
    }

    return {
      module,
      canView: ['Orders', 'Inventory', 'Menu'].includes(module),
      canCreate: false,
      canEdit: module === 'Inventory',
      canDelete: false,
      canExport: false,
      canApprove: false,
    };
  });
}
async function seedInventoryStockActionReasons() {
  const reasons = [
    { name: 'Supplier delivery', actionType: 'Add', sortOrder: 1 },
    { name: 'Opening stock', actionType: 'Add', sortOrder: 2 },
    { name: 'Stock returned', actionType: 'Add', sortOrder: 3 },
    { name: 'Correction', actionType: 'Add', sortOrder: 4 },

    { name: 'Kitchen usage', actionType: 'Reduce', sortOrder: 1 },
    { name: 'Bar usage', actionType: 'Reduce', sortOrder: 2 },
    { name: 'Correction', actionType: 'Reduce', sortOrder: 3 },

    { name: 'Expired', actionType: 'Wastage', sortOrder: 1 },
    { name: 'Spilled', actionType: 'Wastage', sortOrder: 2 },
    { name: 'Damaged', actionType: 'Wastage', sortOrder: 3 },
    { name: 'Kitchen mistake', actionType: 'Wastage', sortOrder: 4 },
    { name: 'Other wastage', actionType: 'Wastage', sortOrder: 5 },

    { name: 'Physical count correction', actionType: 'Adjust', sortOrder: 1 },
    { name: 'Audit correction', actionType: 'Adjust', sortOrder: 2 },
    { name: 'System correction', actionType: 'Adjust', sortOrder: 3 },

    { name: 'Returned to supplier', actionType: 'Return', sortOrder: 1 },
    { name: 'Damaged delivery', actionType: 'Return', sortOrder: 2 },
    { name: 'Wrong item delivered', actionType: 'Return', sortOrder: 3 },
  ] as const;

  for (const reason of reasons) {
    await prisma.inventoryStockActionReason.upsert({
      where: {
        businessId_name: {
          businessId: BUSINESS_ID,
          name: `${reason.actionType}: ${reason.name}`,
        },
      },
      update: {
        name: `${reason.actionType}: ${reason.name}`,
        actionType: reason.actionType,
        status: 'Active',
        sortOrder: reason.sortOrder,
      },
      create: {
        businessId: BUSINESS_ID,
        name: `${reason.actionType}: ${reason.name}`,
        actionType: reason.actionType,
        status: 'Active',
        sortOrder: reason.sortOrder,
      },
    });
  }

  return reasons.length;
}
async function seedInventoryMasterData() {
  const kitchenCategories = [
    { name: 'Meat', sortOrder: 1 },
    { name: 'Dairy', sortOrder: 2 },
    { name: 'Dry Store', sortOrder: 3 },
    { name: 'Vegetables', sortOrder: 4 },
    { name: 'Packaging', sortOrder: 5 },
  ];

  const barCategories = [
    { name: 'Alcohol', sortOrder: 1 },
    { name: 'Beer', sortOrder: 2 },
    { name: 'Soft Drinks', sortOrder: 3 },
    { name: 'Hookah', sortOrder: 4 },
    { name: 'Bar Consumables', sortOrder: 5 },
  ];

  const categories = new Map<string, { id: string }>();

  for (const category of kitchenCategories) {
    const created = await prisma.inventoryCategory.upsert({
      where: {
        businessId_section_name: {
          businessId: BUSINESS_ID,
          section: 'Kitchen',
          name: category.name,
        },
      },
      update: {
        status: 'Active',
        sortOrder: category.sortOrder,
      },
      create: {
        businessId: BUSINESS_ID,
        section: 'Kitchen',
        name: category.name,
        status: 'Active',
        sortOrder: category.sortOrder,
      },
    });

    categories.set(`Kitchen:${category.name}`, created);
  }

  for (const category of barCategories) {
    const created = await prisma.inventoryCategory.upsert({
      where: {
        businessId_section_name: {
          businessId: BUSINESS_ID,
          section: 'Bar',
          name: category.name,
        },
      },
      update: {
        status: 'Active',
        sortOrder: category.sortOrder,
      },
      create: {
        businessId: BUSINESS_ID,
        section: 'Bar',
        name: category.name,
        status: 'Active',
        sortOrder: category.sortOrder,
      },
    });

    categories.set(`Bar:${category.name}`, created);
  }

  const itemTypeNames = [
    'Raw Material',
    'Perishable',
    'Non-Perishable',
    'Beverage',
    'Alcohol',
    'Hookah',
    'Packaging',
    'Cleaning Supply',
  ];

  const itemTypes = new Map<string, { id: string }>();

  for (const [index, name] of itemTypeNames.entries()) {
    const created = await prisma.inventoryItemType.upsert({
      where: {
        businessId_name: {
          businessId: BUSINESS_ID,
          name,
        },
      },
      update: {
        status: 'Active',
        sortOrder: index + 1,
      },
      create: {
        businessId: BUSINESS_ID,
        name,
        status: 'Active',
        sortOrder: index + 1,
      },
    });

    itemTypes.set(name, created);
  }

  const locationNames = [
    'Kitchen Freezer',
    'Kitchen Fridge',
    'Dry Store',
    'Bar Shelf',
    'Bar Chiller',
    'Counter Store',
  ];

  const locations = new Map<string, { id: string }>();

  for (const name of locationNames) {
    const created = await prisma.inventoryLocation.upsert({
      where: {
        businessId_name: {
          businessId: BUSINESS_ID,
          name,
        },
      },
      update: {
        status: 'Active',
      },
      create: {
        businessId: BUSINESS_ID,
        name,
        status: 'Active',
      },
    });

    locations.set(name, created);
  }

  const supplierSeed = [
    {
      name: 'Local Meat Supplier',
      phone: '9800000001',
      address: 'Bharatpur, Chitwan',
    },
    {
      name: 'Dairy Supplier',
      phone: '9800000002',
      address: 'Bharatpur, Chitwan',
    },
    {
      name: 'Vegetable Supplier',
      phone: '9800000003',
      address: 'Bharatpur, Chitwan',
    },
    {
      name: 'Beverage Supplier',
      phone: '9800000004',
      address: 'Bharatpur, Chitwan',
    },
    {
      name: 'Bar Supplier',
      phone: '9800000005',
      address: 'Bharatpur, Chitwan',
    },
  ];

  const suppliers = new Map<string, { id: string }>();

  for (const supplier of supplierSeed) {
    const created = await prisma.inventorySupplier.upsert({
      where: {
        businessId_name: {
          businessId: BUSINESS_ID,
          name: supplier.name,
        },
      },
      update: {
        phone: supplier.phone,
        address: supplier.address,
        status: 'Active',
      },
      create: {
        businessId: BUSINESS_ID,
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
        payableAmount: 0,
        paymentStatus: 'Paid',
        status: 'Active',
      },
    });

    suppliers.set(supplier.name, created);
  }

  const sampleItems = [
    {
      name: 'Chicken',
      section: 'Kitchen' as const,
      category: 'Meat',
      type: 'Perishable',
      unit: 'kg',
      currentStock: 12,
      lowStockLimit: 3,
      costPrice: 420,
      supplier: 'Local Meat Supplier',
      location: 'Kitchen Freezer',
      trackBatch: true,
      trackExpiry: true,
    },
    {
      name: 'Buff Meat',
      section: 'Kitchen' as const,
      category: 'Meat',
      type: 'Perishable',
      unit: 'kg',
      currentStock: 8,
      lowStockLimit: 3,
      costPrice: 520,
      supplier: 'Local Meat Supplier',
      location: 'Kitchen Freezer',
      trackBatch: true,
      trackExpiry: true,
    },
    {
      name: 'Milk',
      section: 'Kitchen' as const,
      category: 'Dairy',
      type: 'Perishable',
      unit: 'liter',
      currentStock: 2,
      lowStockLimit: 5,
      costPrice: 120,
      supplier: 'Dairy Supplier',
      location: 'Kitchen Fridge',
      trackBatch: true,
      trackExpiry: true,
    },
    {
      name: 'Maida',
      section: 'Kitchen' as const,
      category: 'Dry Store',
      type: 'Raw Material',
      unit: 'kg',
      currentStock: 25,
      lowStockLimit: 8,
      costPrice: 85,
      supplier: 'Vegetable Supplier',
      location: 'Dry Store',
      trackBatch: false,
      trackExpiry: false,
    },
    {
      name: 'Cooking Oil',
      section: 'Kitchen' as const,
      category: 'Dry Store',
      type: 'Raw Material',
      unit: 'liter',
      currentStock: 15,
      lowStockLimit: 5,
      costPrice: 260,
      supplier: 'Vegetable Supplier',
      location: 'Dry Store',
      trackBatch: false,
      trackExpiry: false,
    },
    {
      name: 'Takeaway Box',
      section: 'Kitchen' as const,
      category: 'Packaging',
      type: 'Packaging',
      unit: 'piece',
      currentStock: 180,
      lowStockLimit: 50,
      costPrice: 12,
      supplier: 'Beverage Supplier',
      location: 'Counter Store',
      trackBatch: false,
      trackExpiry: false,
    },
    {
      name: 'Vodka',
      section: 'Bar' as const,
      category: 'Alcohol',
      type: 'Alcohol',
      unit: 'ml',
      currentStock: 2250,
      lowStockLimit: 750,
      costPrice: 2.8,
      supplier: 'Bar Supplier',
      location: 'Bar Shelf',
      trackBatch: true,
      trackExpiry: false,
      bottleSizeMl: 750,
    },
    {
      name: 'Beer',
      section: 'Bar' as const,
      category: 'Beer',
      type: 'Beverage',
      unit: 'bottle',
      currentStock: 48,
      lowStockLimit: 12,
      costPrice: 210,
      supplier: 'Beverage Supplier',
      location: 'Bar Chiller',
      trackBatch: true,
      trackExpiry: true,
    },
    {
      name: 'Coke',
      section: 'Bar' as const,
      category: 'Soft Drinks',
      type: 'Beverage',
      unit: 'bottle',
      currentStock: 36,
      lowStockLimit: 12,
      costPrice: 65,
      supplier: 'Beverage Supplier',
      location: 'Bar Chiller',
      trackBatch: false,
      trackExpiry: true,
    },
    {
      name: 'Hookah Flavor',
      section: 'Bar' as const,
      category: 'Hookah',
      type: 'Hookah',
      unit: 'gram',
      currentStock: 900,
      lowStockLimit: 250,
      costPrice: 1.8,
      supplier: 'Bar Supplier',
      location: 'Bar Shelf',
      trackBatch: true,
      trackExpiry: true,
    },
    {
      name: 'Hookah Coal',
      section: 'Bar' as const,
      category: 'Hookah',
      type: 'Hookah',
      unit: 'piece',
      currentStock: 120,
      lowStockLimit: 30,
      costPrice: 8,
      supplier: 'Bar Supplier',
      location: 'Bar Shelf',
      trackBatch: false,
      trackExpiry: false,
    },
  ];

  for (const item of sampleItems) {
    const category = categories.get(`${item.section}:${item.category}`);
    const itemType = itemTypes.get(item.type);
    const supplier = suppliers.get(item.supplier);
    const location = locations.get(item.location);

    if (!category) {
      throw new Error(`Missing inventory category: ${item.section}:${item.category}`);
    }

    if (!itemType) {
      throw new Error(`Missing inventory item type: ${item.type}`);
    }

    await prisma.inventoryItem.upsert({
      where: {
        businessId_section_name: {
          businessId: BUSINESS_ID,
          section: item.section,
          name: item.name,
        },
      },
      update: {
        categoryId: category.id,
        itemTypeId: itemType.id,
        unit: item.unit,
        currentStock: item.currentStock,
        lowStockLimit: item.lowStockLimit,
        costPrice: item.costPrice,
        supplierId: supplier?.id ?? null,
        storageLocationId: location?.id ?? null,
        trackBatch: item.trackBatch,
        trackExpiry: item.trackExpiry,
        bottleSizeMl: 'bottleSizeMl' in item ? item.bottleSizeMl : null,
        status: 'Active',
        isTrashed: false,
      },
      create: {
        businessId: BUSINESS_ID,
        name: item.name,
        section: item.section,
        categoryId: category.id,
        itemTypeId: itemType.id,
        unit: item.unit,
        currentStock: item.currentStock,
        lowStockLimit: item.lowStockLimit,
        costPrice: item.costPrice,
        supplierId: supplier?.id ?? null,
        storageLocationId: location?.id ?? null,
        trackBatch: item.trackBatch,
        trackExpiry: item.trackExpiry,
        bottleSizeMl: 'bottleSizeMl' in item ? item.bottleSizeMl : null,
        status: 'Active',
        isTrashed: false,
        lastMovementAt: new Date(),
      },
    });
  }

  return {
    categories: categories.size,
    itemTypes: itemTypes.size,
    locations: locations.size,
    suppliers: suppliers.size,
    items: sampleItems.length,
  };
}

async function main() {
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  const business = await prisma.business.upsert({
    where: {
      id: BUSINESS_ID,
    },
    update: {},
    create: {
      id: BUSINESS_ID,
      name: 'Softzeno Demo Restaurant',
      legalName: 'Softzeno Demo Restaurant Pvt. Ltd.',
      panVatNumber: '000000000',
      businessType: 'Restaurant',
      phone: '+977 9800000000',
      email: 'admin@softzeno.com',
      address: 'Bharatpur, Chitwan, Nepal',
      defaultCurrency: 'NPR',
      timezone: 'Asia/Kathmandu',
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      businessId_code: {
        businessId: business.id,
        code: 'BHR',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      name: 'Bharatpur Main Branch',
      code: 'BHR',
      address: 'Bharatpur, Chitwan, Nepal',
      phone: '+977 9800000000',
      panVatNumber: business.panVatNumber,
      isActive: true,
    },
  });

  const terminal = await prisma.terminal.upsert({
    where: {
      branchId_code: {
        branchId: branch.id,
        code: 'POS-01',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      branchId: branch.id,
      code: 'POS-01',
      name: 'Main Counter POS',
      isActive: true,
    },
  });

  const roleNames: UserRoleName[] = [
    'Owner',
    'Admin',
    'Manager',
    'Cashier',
    'Waiter',
    'Kitchen',
  ];

  const roles = new Map<UserRoleName, { id: string }>();

  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: {
        businessId_name: {
          businessId: business.id,
          name: roleName,
        },
      },
      update: {},
      create: {
        businessId: business.id,
        name: roleName,
        description: `${roleName} role`,
        isSystemRole: true,
      },
    });

    roles.set(roleName, role);

    const rolePermissions = permissionsForRole(roleName);

    for (const permission of rolePermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_module: {
            roleId: role.id,
            module: permission.module,
          },
        },
        update: {
          canView: permission.canView,
          canCreate: permission.canCreate,
          canEdit: permission.canEdit,
          canDelete: permission.canDelete,
          canExport: permission.canExport,
          canApprove: permission.canApprove,
        },
        create: {
          roleId: role.id,
          ...permission,
        },
      });
    }
  }

  const adminRole = roles.get('Admin');

  if (!adminRole) {
    throw new Error('Admin role was not created.');
  }

  await prisma.user.upsert({
    where: {
      businessId_username: {
        businessId: business.id,
        username: '@admin',
      },
    },
    update: {
      passwordHash,
      status: 'Active',
      mustChangePassword: false,
    },
    create: {
      businessId: business.id,
      branchId: branch.id,
      roleId: adminRole.id,
      firstName: 'Softzeno',
      lastName: 'Admin',
      username: '@admin',
      phone: '9800000000',
      email: 'admin@softzeno.com',
      passwordHash,
      status: 'Active',
      mustChangePassword: false,
      maxDiscountPercent: 100,
    },
  });

  const fiscalYear = await prisma.fiscalYear.upsert({
    where: {
      businessId_branchId_label: {
        businessId: business.id,
        branchId: branch.id,
        label: '2082/83',
      },
    },
    update: {
      status: 'Open',
    },
    create: {
      businessId: business.id,
      branchId: branch.id,
      label: '2082/83',
      startsAt: new Date('2025-07-17T00:00:00.000Z'),
      endsAt: new Date('2026-07-16T23:59:59.999Z'),
      status: 'Open',
      invoicePrefix: 'SZ-BHR-2082-83',
    },
  });

  await prisma.invoiceSequence.upsert({
    where: {
      branchId_fiscalYearId_invoiceType_prefix: {
        branchId: branch.id,
        fiscalYearId: fiscalYear.id,
        invoiceType: 'TaxInvoice',
        prefix: 'SZ-BHR-2082-83',
      },
    },
    update: {},
    create: {
      businessId: business.id,
      branchId: branch.id,
      terminalId: terminal.id,
      fiscalYearId: fiscalYear.id,
      invoiceType: 'TaxInvoice',
      prefix: 'SZ-BHR-2082-83',
      currentSequence: 0,
      locked: false,
    },
  });

  const inventorySeed = await seedInventoryMasterData();
const stockActionReasons = await seedInventoryStockActionReasons();

console.log('Seed completed successfully.');
  console.log({
    business: business.name,
    branch: branch.code,
    terminal: terminal.code,
    adminUsername: '@admin',
    adminPassword: 'Admin@12345',
    fiscalYear: fiscalYear.label,
    invoicePrefix: fiscalYear.invoicePrefix,
    inventory: inventorySeed,
    stockActionReasons,
  });
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });