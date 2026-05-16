-- CreateEnum
CREATE TYPE "UserRoleName" AS ENUM ('Owner', 'Admin', 'Manager', 'Cashier', 'Waiter', 'Kitchen');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('Open', 'Locked', 'Closed');

-- CreateEnum
CREATE TYPE "MenuItemStatus" AS ENUM ('Available', 'Unavailable');

-- CreateEnum
CREATE TYPE "InventorySection" AS ENUM ('Kitchen', 'Bar');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "InventorySettingStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "InventoryStockActionType" AS ENUM ('Add', 'Reduce', 'Wastage', 'Adjust', 'Return', 'Opening', 'Reserve', 'Release');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('Reserved', 'Consumed', 'Released');

-- CreateEnum
CREATE TYPE "RestaurantTableStatus" AS ENUM ('Free', 'Occupied', 'Reserved');

-- CreateEnum
CREATE TYPE "PosOrderStatus" AS ENUM ('Draft', 'KotSent', 'InProgress', 'Completed', 'Cancelled');

-- CreateEnum
CREATE TYPE "PosOrderItemStatus" AS ENUM ('Draft', 'Sent', 'Preparing', 'Ready', 'Served', 'Voided', 'Cancelled');

-- CreateEnum
CREATE TYPE "KotTicketStatus" AS ENUM ('Sent', 'Preparing', 'Ready', 'Served', 'Cancelled');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('Created', 'ItemAdded', 'ItemUpdated', 'ItemRemoved', 'KotSent', 'ItemVoided', 'OrderCancelled', 'Transferred', 'Merged', 'Finalized');

-- CreateEnum
CREATE TYPE "RestaurantTableShape" AS ENUM ('round', 'square', 'rectangle');

-- CreateEnum
CREATE TYPE "CanvasSizeType" AS ENUM ('square', 'standard', 'wide', 'tall', 'custom');

-- CreateEnum
CREATE TYPE "FloorBlockType" AS ENUM ('wall', 'pillar', 'counter', 'cashier', 'kitchen', 'bar', 'door', 'washroom', 'service', 'waiting', 'plant', 'custom');

-- CreateEnum
CREATE TYPE "FloorLayoutColor" AS ENUM ('slate', 'zinc', 'stone', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'amber', 'orange', 'red', 'rose', 'pink');

-- CreateEnum
CREATE TYPE "FloorLineStyle" AS ENUM ('solid', 'dashed', 'dotted');

-- CreateEnum
CREATE TYPE "FloorTextWeight" AS ENUM ('normal', 'bold', 'black');

-- CreateEnum
CREATE TYPE "FloorTextAlign" AS ENUM ('left', 'center', 'right');

-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('Open', 'Closed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('Cash', 'QR', 'Card', 'Credit', 'Mixed');

-- CreateEnum
CREATE TYPE "InvoiceDocumentType" AS ENUM ('TaxInvoice', 'AbbreviatedTaxInvoice', 'CreditNote', 'DebitNote', 'VoidNote');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('Draft', 'Finalized', 'Voided', 'Corrected', 'CreditNoteIssued');

-- CreateEnum
CREATE TYPE "InvoicePaymentStatus" AS ENUM ('Paid', 'PartiallyPaid', 'CreditOpen', 'CreditPartiallyCleared', 'CreditCleared', 'Voided');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('Cash', 'QR', 'Card', 'Credit', 'Mixed');

-- CreateEnum
CREATE TYPE "PaymentReceiptStatus" AS ENUM ('Pending', 'Completed', 'Voided', 'Refunded', 'Failed');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('NotRequired', 'Pending', 'Processing', 'PartiallySettled', 'Settled', 'Failed', 'Disputed');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('PosInvoice', 'LedgerCollection', 'SupplierPayment', 'StaffSettlement', 'Manual');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('Customer', 'Staff', 'Supplier');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('PosCreditBill', 'SupplierPurchase', 'Payment', 'ManualAdjustment', 'OpeningBalance', 'Correction');

-- CreateEnum
CREATE TYPE "CbmsStatus" AS ENUM ('Pending', 'Synced', 'Failed', 'Retrying', 'Exempt');

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('Active', 'Archived', 'Deleted');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('System', 'User', 'Assistant', 'Tool');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('Pending', 'Running', 'Success', 'Failed', 'Cancelled', 'ConfigRequired');

-- CreateEnum
CREATE TYPE "AiToolRunStatus" AS ENUM ('Pending', 'Running', 'Success', 'Failed', 'Skipped');

-- CreateTable
CREATE TABLE "MenuSection" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kotDestination" TEXT NOT NULL DEFAULT 'Kitchen',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuType" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatIncluded" BOOLEAN NOT NULL DEFAULT true,
    "kotDestination" TEXT NOT NULL DEFAULT 'Kitchen',
    "status" "MenuItemStatus" NOT NULL DEFAULT 'Available',
    "showInPOS" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER,
    "lowStockLimit" INTEGER,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "section" "InventorySection" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventorySettingStatus" NOT NULL DEFAULT 'Active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItemType" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventorySettingStatus" NOT NULL DEFAULT 'Active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItemType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockBatch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT,
    "batchNo" TEXT,
    "quantityAdded" DECIMAL(12,4) NOT NULL,
    "remainingQuantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inventoryCategoryId" TEXT,

    CONSTRAINT "InventoryStockBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockMovement" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "supplierId" TEXT,
    "actionType" "InventoryStockActionType" NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "beforeStock" DECIMAL(12,4) NOT NULL,
    "afterStock" DECIMAL(12,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "performedBy" TEXT NOT NULL DEFAULT 'Admin',
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inventoryCategoryId" TEXT,

    CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "menuItemName" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "inventoryName" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'Reserved',
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockActionReason" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actionType" "InventoryStockActionType",
    "status" "InventorySettingStatus" NOT NULL DEFAULT 'Active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryStockActionReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InventorySettingStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySupplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "payableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Paid',
    "status" "InventorySettingStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "section" "InventorySection" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "itemTypeId" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "lowStockLimit" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "costPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "storageLocationId" TEXT,
    "trackBatch" BOOLEAN NOT NULL DEFAULT false,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'Active',
    "statusBeforeTrash" "InventoryItemStatus",
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "trashedAt" TIMESTAMP(3),
    "trashedBy" TEXT,
    "trashReason" TEXT,
    "bottleSizeMl" INTEGER,
    "itemsPerPacket" INTEGER,
    "lastMovementAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemRecipeIngredient" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "wastePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inventoryCategoryId" TEXT,

    CONSTRAINT "MenuItemRecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableArea" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrder" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT,
    "tableId" TEXT,
    "tableName" TEXT,
    "areaId" TEXT,
    "areaName" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "PosOrderStatus" NOT NULL DEFAULT 'Draft',
    "guestCount" INTEGER,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 13,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "cancelReason" TEXT,
    "openedById" TEXT,
    "openedByName" TEXT,
    "closedById" TEXT,
    "closedByName" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastKotAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "section" TEXT,
    "typeName" TEXT,
    "kotDestination" TEXT NOT NULL DEFAULT 'Kitchen',
    "qty" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PosOrderItemStatus" NOT NULL DEFAULT 'Draft',
    "note" TEXT,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "orderId" TEXT NOT NULL,
    "kotNumber" TEXT NOT NULL,
    "destination" TEXT NOT NULL DEFAULT 'Kitchen',
    "status" "KotTicketStatus" NOT NULL DEFAULT 'Sent',
    "tableId" TEXT,
    "tableName" TEXT,
    "areaName" TEXT,
    "sentById" TEXT,
    "sentByName" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preparedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KotTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KotTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KotTicketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "orderId" TEXT NOT NULL,
    "eventType" "OrderEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "performedById" TEXT,
    "performedByName" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 4,
    "shape" "RestaurantTableShape" NOT NULL DEFAULT 'round',
    "status" "RestaurantTableStatus" NOT NULL DEFAULT 'Free',
    "x" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "y" DECIMAL(6,2) NOT NULL DEFAULT 10,
    "width" DECIMAL(6,2) NOT NULL DEFAULT 9,
    "height" DECIMAL(6,2) NOT NULL DEFAULT 13,
    "activeOrderId" TEXT,
    "activeOrderNumber" TEXT,
    "currentGuests" INTEGER,
    "currentAmount" DECIMAL(12,2),
    "lastOrderAt" TIMESTAMP(3),
    "reservationName" TEXT,
    "reservationPhone" TEXT,
    "reservationGuests" INTEGER,
    "reservationTime" TEXT,
    "reservationNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorLayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "areaId" TEXT NOT NULL,
    "canvasType" "CanvasSizeType" NOT NULL DEFAULT 'standard',
    "width" INTEGER NOT NULL DEFAULT 1200,
    "height" INTEGER NOT NULL DEFAULT 720,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorBlock" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "blockType" "FloorBlockType" NOT NULL DEFAULT 'custom',
    "color" "FloorLayoutColor" NOT NULL DEFAULT 'slate',
    "showLabel" BOOLEAN NOT NULL DEFAULT true,
    "x" DECIMAL(6,2) NOT NULL,
    "y" DECIMAL(6,2) NOT NULL,
    "width" DECIMAL(6,2) NOT NULL,
    "height" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorZone" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" "FloorLayoutColor" NOT NULL DEFAULT 'slate',
    "opacity" DECIMAL(4,2) NOT NULL DEFAULT 0.16,
    "showLabel" BOOLEAN NOT NULL DEFAULT true,
    "x" DECIMAL(6,2) NOT NULL,
    "y" DECIMAL(6,2) NOT NULL,
    "width" DECIMAL(6,2) NOT NULL,
    "height" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorLine" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "x1" DECIMAL(6,2) NOT NULL,
    "y1" DECIMAL(6,2) NOT NULL,
    "x2" DECIMAL(6,2) NOT NULL,
    "y2" DECIMAL(6,2) NOT NULL,
    "thickness" INTEGER NOT NULL DEFAULT 2,
    "color" "FloorLayoutColor" NOT NULL DEFAULT 'slate',
    "style" "FloorLineStyle" NOT NULL DEFAULT 'solid',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorText" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "color" "FloorLayoutColor" NOT NULL DEFAULT 'slate',
    "fontSize" INTEGER NOT NULL DEFAULT 16,
    "fontWeight" "FloorTextWeight" NOT NULL DEFAULT 'bold',
    "align" "FloorTextAlign" NOT NULL DEFAULT 'center',
    "background" BOOLEAN NOT NULL DEFAULT false,
    "x" DECIMAL(6,2) NOT NULL,
    "y" DECIMAL(6,2) NOT NULL,
    "width" DECIMAL(6,2) NOT NULL,
    "height" DECIMAL(6,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorText_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "panVatNumber" TEXT,
    "businessType" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NPR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kathmandu',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "panVatNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Terminal" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceFingerprint" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Terminal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" "UserRoleName" NOT NULL,
    "description" TEXT,
    "isSystemRole" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "roleId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'Active',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastLoginAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalYear" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'Open',
    "invoicePrefix" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiscalYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT,
    "fiscalYearId" TEXT NOT NULL,
    "invoiceType" "InvoiceDocumentType" NOT NULL,
    "prefix" TEXT NOT NULL,
    "currentSequence" INTEGER NOT NULL DEFAULT 0,
    "lastInvoiceNumber" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New AI conversation',
    "status" "AiConversationStatus" NOT NULL DEFAULT 'Active',
    "model" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "agentId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAgentRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "model" TEXT,
    "question" TEXT NOT NULL,
    "questionHash" TEXT,
    "contextScope" TEXT,
    "status" "AiRunStatus" NOT NULL DEFAULT 'Pending',
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolRun" (
    "id" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "status" "AiToolRunStatus" NOT NULL DEFAULT 'Pending',
    "input" JSONB,
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiToolRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAuditLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "agentId" TEXT,
    "conversationId" TEXT,
    "agentRunId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "performedById" TEXT,
    "performedByName" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceType" "InvoiceDocumentType" NOT NULL DEFAULT 'TaxInvoice',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'Finalized',
    "paymentStatus" "InvoicePaymentStatus" NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "tableId" TEXT,
    "tableName" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "customerPanVat" TEXT,
    "grossTotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "taxableSubtotal" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "grandTotal" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL,
    "creditAmount" DECIMAL(12,2) NOT NULL,
    "cashierId" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "serverId" TEXT,
    "serverName" TEXT,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "cbmsStatus" "CbmsStatus" NOT NULL DEFAULT 'Pending',
    "cbmsSyncedAt" TIMESTAMP(3),
    "cbmsResponseCode" TEXT,
    "cbmsErrorMessage" TEXT,
    "cbmsRetryCount" INTEGER NOT NULL DEFAULT 0,
    "originalInvoiceId" TEXT,
    "originalInvoiceNumber" TEXT,
    "immutableHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "qty" DECIMAL(10,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxableAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "kotNumber" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReceipt" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "ledgerEntryId" TEXT,
    "accountId" TEXT,
    "accountName" TEXT,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAmount" DECIMAL(12,2),
    "changeReturn" DECIMAL(12,2),
    "provider" TEXT,
    "referenceNumber" TEXT,
    "bankName" TEXT,
    "cashSessionId" TEXT,
    "status" "PaymentReceiptStatus" NOT NULL DEFAULT 'Completed',
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'NotRequired',
    "settlementBatchId" TEXT,
    "settlementReference" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "settledByName" TEXT,
    "settlementNote" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedByName" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "refundReason" TEXT,
    "refundedAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPart" (
    "id" TEXT NOT NULL,
    "paymentReceiptId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "provider" TEXT,
    "referenceNumber" TEXT,
    "bankName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "terminalId" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashIn" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cashOut" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expectedCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedCash" DECIMAL(12,2),
    "difference" DECIMAL(12,2),
    "status" "CashSessionStatus" NOT NULL DEFAULT 'Open',
    "openedById" TEXT NOT NULL,
    "openedByName" TEXT NOT NULL,
    "closedById" TEXT,
    "closedByName" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closeNote" TEXT,
    "managerApprovalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "LedgerAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "creditLimit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isCreditBlocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "reference" TEXT NOT NULL,
    "kind" "LedgerEntryKind" NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "handledById" TEXT NOT NULL,
    "handledByName" TEXT NOT NULL,
    "invoiceId" TEXT,
    "invoiceNumber" TEXT,
    "paymentReceiptId" TEXT,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "voidedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAllocation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "ledgerAccountId" TEXT NOT NULL,
    "paymentEntryId" TEXT NOT NULL,
    "targetEntryId" TEXT NOT NULL,
    "targetReference" TEXT NOT NULL,
    "appliedAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTrail" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CbmsSyncLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestPayloadHash" TEXT,
    "responseCode" TEXT,
    "responseMessage" TEXT,
    "errorMessage" TEXT,
    "attemptedById" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CbmsSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuSection_businessId_idx" ON "MenuSection"("businessId");

-- CreateIndex
CREATE INDEX "MenuSection_businessId_isActive_idx" ON "MenuSection"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuSection_businessId_name_key" ON "MenuSection"("businessId", "name");

-- CreateIndex
CREATE INDEX "MenuCategory_businessId_idx" ON "MenuCategory"("businessId");

-- CreateIndex
CREATE INDEX "MenuCategory_businessId_sectionId_idx" ON "MenuCategory"("businessId", "sectionId");

-- CreateIndex
CREATE INDEX "MenuCategory_businessId_isActive_idx" ON "MenuCategory"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_businessId_sectionId_name_key" ON "MenuCategory"("businessId", "sectionId", "name");

-- CreateIndex
CREATE INDEX "MenuType_businessId_idx" ON "MenuType"("businessId");

-- CreateIndex
CREATE INDEX "MenuType_businessId_sectionId_idx" ON "MenuType"("businessId", "sectionId");

-- CreateIndex
CREATE INDEX "MenuType_businessId_categoryId_idx" ON "MenuType"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "MenuType_businessId_isActive_idx" ON "MenuType"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuType_businessId_categoryId_name_key" ON "MenuType"("businessId", "categoryId", "name");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_idx" ON "MenuItem"("businessId");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_sectionId_idx" ON "MenuItem"("businessId", "sectionId");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_categoryId_idx" ON "MenuItem"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_typeId_idx" ON "MenuItem"("businessId", "typeId");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_status_idx" ON "MenuItem"("businessId", "status");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_showInPOS_idx" ON "MenuItem"("businessId", "showInPOS");

-- CreateIndex
CREATE INDEX "MenuItem_businessId_isTrashed_idx" ON "MenuItem"("businessId", "isTrashed");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_businessId_typeId_name_key" ON "MenuItem"("businessId", "typeId", "name");

-- CreateIndex
CREATE INDEX "InventoryCategory_businessId_idx" ON "InventoryCategory"("businessId");

-- CreateIndex
CREATE INDEX "InventoryCategory_businessId_section_idx" ON "InventoryCategory"("businessId", "section");

-- CreateIndex
CREATE INDEX "InventoryCategory_businessId_status_idx" ON "InventoryCategory"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_businessId_section_name_key" ON "InventoryCategory"("businessId", "section", "name");

-- CreateIndex
CREATE INDEX "InventoryItemType_businessId_idx" ON "InventoryItemType"("businessId");

-- CreateIndex
CREATE INDEX "InventoryItemType_businessId_status_idx" ON "InventoryItemType"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItemType_businessId_name_key" ON "InventoryItemType"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryStockBatch_businessId_idx" ON "InventoryStockBatch"("businessId");

-- CreateIndex
CREATE INDEX "InventoryStockBatch_businessId_itemId_idx" ON "InventoryStockBatch"("businessId", "itemId");

-- CreateIndex
CREATE INDEX "InventoryStockBatch_businessId_supplierId_idx" ON "InventoryStockBatch"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "InventoryStockBatch_businessId_expiryDate_idx" ON "InventoryStockBatch"("businessId", "expiryDate");

-- CreateIndex
CREATE INDEX "InventoryStockBatch_businessId_remainingQuantity_idx" ON "InventoryStockBatch"("businessId", "remainingQuantity");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_businessId_idx" ON "InventoryStockMovement"("businessId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_businessId_itemId_idx" ON "InventoryStockMovement"("businessId", "itemId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_businessId_supplierId_idx" ON "InventoryStockMovement"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_businessId_actionType_idx" ON "InventoryStockMovement"("businessId", "actionType");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_businessId_createdAt_idx" ON "InventoryStockMovement"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_idx" ON "InventoryReservation"("businessId");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_branchId_idx" ON "InventoryReservation"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_orderId_idx" ON "InventoryReservation"("businessId", "orderId");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_orderItemId_idx" ON "InventoryReservation"("businessId", "orderItemId");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_inventoryItemId_idx" ON "InventoryReservation"("businessId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryReservation_businessId_status_idx" ON "InventoryReservation"("businessId", "status");

-- CreateIndex
CREATE INDEX "InventoryStockActionReason_businessId_idx" ON "InventoryStockActionReason"("businessId");

-- CreateIndex
CREATE INDEX "InventoryStockActionReason_businessId_actionType_idx" ON "InventoryStockActionReason"("businessId", "actionType");

-- CreateIndex
CREATE INDEX "InventoryStockActionReason_businessId_status_idx" ON "InventoryStockActionReason"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryStockActionReason_businessId_name_key" ON "InventoryStockActionReason"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryLocation_businessId_idx" ON "InventoryLocation"("businessId");

-- CreateIndex
CREATE INDEX "InventoryLocation_businessId_status_idx" ON "InventoryLocation"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_businessId_name_key" ON "InventoryLocation"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventorySupplier_businessId_idx" ON "InventorySupplier"("businessId");

-- CreateIndex
CREATE INDEX "InventorySupplier_businessId_status_idx" ON "InventorySupplier"("businessId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySupplier_businessId_name_key" ON "InventorySupplier"("businessId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_idx" ON "InventoryItem"("businessId");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_section_idx" ON "InventoryItem"("businessId", "section");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_categoryId_idx" ON "InventoryItem"("businessId", "categoryId");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_itemTypeId_idx" ON "InventoryItem"("businessId", "itemTypeId");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_supplierId_idx" ON "InventoryItem"("businessId", "supplierId");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_storageLocationId_idx" ON "InventoryItem"("businessId", "storageLocationId");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_status_idx" ON "InventoryItem"("businessId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_businessId_isTrashed_idx" ON "InventoryItem"("businessId", "isTrashed");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_businessId_section_name_key" ON "InventoryItem"("businessId", "section", "name");

-- CreateIndex
CREATE INDEX "MenuItemRecipeIngredient_businessId_idx" ON "MenuItemRecipeIngredient"("businessId");

-- CreateIndex
CREATE INDEX "MenuItemRecipeIngredient_businessId_menuItemId_idx" ON "MenuItemRecipeIngredient"("businessId", "menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemRecipeIngredient_businessId_inventoryItemId_idx" ON "MenuItemRecipeIngredient"("businessId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "MenuItemRecipeIngredient_businessId_isActive_idx" ON "MenuItemRecipeIngredient"("businessId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemRecipeIngredient_businessId_menuItemId_inventoryIte_key" ON "MenuItemRecipeIngredient"("businessId", "menuItemId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "TableArea_businessId_idx" ON "TableArea"("businessId");

-- CreateIndex
CREATE INDEX "TableArea_businessId_branchId_idx" ON "TableArea"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "TableArea_businessId_isActive_idx" ON "TableArea"("businessId", "isActive");

-- CreateIndex
CREATE INDEX "TableArea_businessId_isDeleted_idx" ON "TableArea"("businessId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "TableArea_businessId_branchId_name_key" ON "TableArea"("businessId", "branchId", "name");

-- CreateIndex
CREATE INDEX "PosOrder_businessId_branchId_status_idx" ON "PosOrder"("businessId", "branchId", "status");

-- CreateIndex
CREATE INDEX "PosOrder_businessId_branchId_tableId_status_idx" ON "PosOrder"("businessId", "branchId", "tableId", "status");

-- CreateIndex
CREATE INDEX "PosOrder_businessId_openedAt_idx" ON "PosOrder"("businessId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PosOrder_businessId_branchId_orderNumber_key" ON "PosOrder"("businessId", "branchId", "orderNumber");

-- CreateIndex
CREATE INDEX "PosOrderItem_orderId_idx" ON "PosOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PosOrderItem_businessId_branchId_idx" ON "PosOrderItem"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "PosOrderItem_menuItemId_idx" ON "PosOrderItem"("menuItemId");

-- CreateIndex
CREATE INDEX "PosOrderItem_status_idx" ON "PosOrderItem"("status");

-- CreateIndex
CREATE INDEX "KotTicket_businessId_branchId_status_idx" ON "KotTicket"("businessId", "branchId", "status");

-- CreateIndex
CREATE INDEX "KotTicket_orderId_idx" ON "KotTicket"("orderId");

-- CreateIndex
CREATE INDEX "KotTicket_destination_idx" ON "KotTicket"("destination");

-- CreateIndex
CREATE UNIQUE INDEX "KotTicket_businessId_branchId_kotNumber_key" ON "KotTicket"("businessId", "branchId", "kotNumber");

-- CreateIndex
CREATE INDEX "KotTicketItem_ticketId_idx" ON "KotTicketItem"("ticketId");

-- CreateIndex
CREATE INDEX "KotTicketItem_orderItemId_idx" ON "KotTicketItem"("orderItemId");

-- CreateIndex
CREATE INDEX "KotTicketItem_businessId_branchId_idx" ON "KotTicketItem"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_performedAt_idx" ON "OrderEvent"("orderId", "performedAt");

-- CreateIndex
CREATE INDEX "OrderEvent_businessId_branchId_eventType_idx" ON "OrderEvent"("businessId", "branchId", "eventType");

-- CreateIndex
CREATE INDEX "RestaurantTable_businessId_idx" ON "RestaurantTable"("businessId");

-- CreateIndex
CREATE INDEX "RestaurantTable_businessId_branchId_idx" ON "RestaurantTable"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "RestaurantTable_businessId_areaId_idx" ON "RestaurantTable"("businessId", "areaId");

-- CreateIndex
CREATE INDEX "RestaurantTable_businessId_status_idx" ON "RestaurantTable"("businessId", "status");

-- CreateIndex
CREATE INDEX "RestaurantTable_businessId_isDeleted_idx" ON "RestaurantTable"("businessId", "isDeleted");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantTable_businessId_areaId_name_key" ON "RestaurantTable"("businessId", "areaId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FloorLayout_areaId_key" ON "FloorLayout"("areaId");

-- CreateIndex
CREATE INDEX "FloorLayout_businessId_idx" ON "FloorLayout"("businessId");

-- CreateIndex
CREATE INDEX "FloorLayout_businessId_branchId_idx" ON "FloorLayout"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "FloorBlock_layoutId_idx" ON "FloorBlock"("layoutId");

-- CreateIndex
CREATE INDEX "FloorBlock_areaId_idx" ON "FloorBlock"("areaId");

-- CreateIndex
CREATE INDEX "FloorZone_layoutId_idx" ON "FloorZone"("layoutId");

-- CreateIndex
CREATE INDEX "FloorZone_areaId_idx" ON "FloorZone"("areaId");

-- CreateIndex
CREATE INDEX "FloorLine_layoutId_idx" ON "FloorLine"("layoutId");

-- CreateIndex
CREATE INDEX "FloorLine_areaId_idx" ON "FloorLine"("areaId");

-- CreateIndex
CREATE INDEX "FloorText_layoutId_idx" ON "FloorText"("layoutId");

-- CreateIndex
CREATE INDEX "FloorText_areaId_idx" ON "FloorText"("areaId");

-- CreateIndex
CREATE INDEX "Branch_businessId_idx" ON "Branch"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_businessId_code_key" ON "Branch"("businessId", "code");

-- CreateIndex
CREATE INDEX "Terminal_businessId_branchId_idx" ON "Terminal"("businessId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Terminal_branchId_code_key" ON "Terminal"("branchId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_businessId_name_key" ON "Role"("businessId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_module_key" ON "RolePermission"("roleId", "module");

-- CreateIndex
CREATE INDEX "User_businessId_branchId_idx" ON "User"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_businessId_username_key" ON "User"("businessId", "username");

-- CreateIndex
CREATE INDEX "FiscalYear_businessId_branchId_status_idx" ON "FiscalYear"("businessId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalYear_businessId_branchId_label_key" ON "FiscalYear"("businessId", "branchId", "label");

-- CreateIndex
CREATE INDEX "InvoiceSequence_businessId_branchId_fiscalYearId_idx" ON "InvoiceSequence"("businessId", "branchId", "fiscalYearId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_branchId_fiscalYearId_invoiceType_prefix_key" ON "InvoiceSequence"("branchId", "fiscalYearId", "invoiceType", "prefix");

-- CreateIndex
CREATE INDEX "AiConversation_businessId_idx" ON "AiConversation"("businessId");

-- CreateIndex
CREATE INDEX "AiConversation_businessId_branchId_idx" ON "AiConversation"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "AiConversation_businessId_userId_idx" ON "AiConversation"("businessId", "userId");

-- CreateIndex
CREATE INDEX "AiConversation_businessId_agentId_idx" ON "AiConversation"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "AiConversation_businessId_status_idx" ON "AiConversation"("businessId", "status");

-- CreateIndex
CREATE INDEX "AiConversation_lastMessageAt_idx" ON "AiConversation"("lastMessageAt");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_idx" ON "AiMessage"("conversationId");

-- CreateIndex
CREATE INDEX "AiMessage_businessId_idx" ON "AiMessage"("businessId");

-- CreateIndex
CREATE INDEX "AiMessage_businessId_branchId_idx" ON "AiMessage"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "AiMessage_businessId_userId_idx" ON "AiMessage"("businessId", "userId");

-- CreateIndex
CREATE INDEX "AiMessage_businessId_agentId_idx" ON "AiMessage"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "AiMessage_createdAt_idx" ON "AiMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AiAgentRun_conversationId_idx" ON "AiAgentRun"("conversationId");

-- CreateIndex
CREATE INDEX "AiAgentRun_businessId_idx" ON "AiAgentRun"("businessId");

-- CreateIndex
CREATE INDEX "AiAgentRun_businessId_branchId_idx" ON "AiAgentRun"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "AiAgentRun_businessId_userId_idx" ON "AiAgentRun"("businessId", "userId");

-- CreateIndex
CREATE INDEX "AiAgentRun_businessId_agentId_idx" ON "AiAgentRun"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "AiAgentRun_status_idx" ON "AiAgentRun"("status");

-- CreateIndex
CREATE INDEX "AiAgentRun_startedAt_idx" ON "AiAgentRun"("startedAt");

-- CreateIndex
CREATE INDEX "AiToolRun_agentRunId_idx" ON "AiToolRun"("agentRunId");

-- CreateIndex
CREATE INDEX "AiToolRun_businessId_idx" ON "AiToolRun"("businessId");

-- CreateIndex
CREATE INDEX "AiToolRun_businessId_branchId_idx" ON "AiToolRun"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "AiToolRun_businessId_userId_idx" ON "AiToolRun"("businessId", "userId");

-- CreateIndex
CREATE INDEX "AiToolRun_businessId_agentId_idx" ON "AiToolRun"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "AiToolRun_toolName_idx" ON "AiToolRun"("toolName");

-- CreateIndex
CREATE INDEX "AiToolRun_status_idx" ON "AiToolRun"("status");

-- CreateIndex
CREATE INDEX "AiToolRun_startedAt_idx" ON "AiToolRun"("startedAt");

-- CreateIndex
CREATE INDEX "AiAuditLog_businessId_idx" ON "AiAuditLog"("businessId");

-- CreateIndex
CREATE INDEX "AiAuditLog_businessId_branchId_idx" ON "AiAuditLog"("businessId", "branchId");

-- CreateIndex
CREATE INDEX "AiAuditLog_businessId_userId_idx" ON "AiAuditLog"("businessId", "userId");

-- CreateIndex
CREATE INDEX "AiAuditLog_businessId_agentId_idx" ON "AiAuditLog"("businessId", "agentId");

-- CreateIndex
CREATE INDEX "AiAuditLog_conversationId_idx" ON "AiAuditLog"("conversationId");

-- CreateIndex
CREATE INDEX "AiAuditLog_agentRunId_idx" ON "AiAuditLog"("agentRunId");

-- CreateIndex
CREATE INDEX "AiAuditLog_action_idx" ON "AiAuditLog"("action");

-- CreateIndex
CREATE INDEX "AiAuditLog_performedAt_idx" ON "AiAuditLog"("performedAt");

-- CreateIndex
CREATE INDEX "Invoice_businessId_branchId_finalizedAt_idx" ON "Invoice"("businessId", "branchId", "finalizedAt");

-- CreateIndex
CREATE INDEX "Invoice_cbmsStatus_finalizedAt_idx" ON "Invoice"("cbmsStatus", "finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_branchId_fiscalYearId_invoiceNumber_key" ON "Invoice"("businessId", "branchId", "fiscalYearId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentReceipt_businessId_branchId_receivedAt_idx" ON "PaymentReceipt"("businessId", "branchId", "receivedAt");

-- CreateIndex
CREATE INDEX "PaymentReceipt_businessId_branchId_settlementStatus_idx" ON "PaymentReceipt"("businessId", "branchId", "settlementStatus");

-- CreateIndex
CREATE INDEX "PaymentReceipt_businessId_branchId_settlementBatchId_idx" ON "PaymentReceipt"("businessId", "branchId", "settlementBatchId");

-- CreateIndex
CREATE INDEX "PaymentReceipt_invoiceId_idx" ON "PaymentReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentReceipt_accountId_idx" ON "PaymentReceipt"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReceipt_businessId_branchId_receiptNumber_key" ON "PaymentReceipt"("businessId", "branchId", "receiptNumber");

-- CreateIndex
CREATE INDEX "PaymentPart_paymentReceiptId_idx" ON "PaymentPart"("paymentReceiptId");

-- CreateIndex
CREATE INDEX "CashSession_businessId_branchId_terminalId_status_idx" ON "CashSession"("businessId", "branchId", "terminalId", "status");

-- CreateIndex
CREATE INDEX "CashSession_businessId_branchId_openedAt_idx" ON "CashSession"("businessId", "branchId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_businessId_branchId_terminalId_sessionNumber_key" ON "CashSession"("businessId", "branchId", "terminalId", "sessionNumber");

-- CreateIndex
CREATE INDEX "LedgerAccount_businessId_type_name_idx" ON "LedgerAccount"("businessId", "type", "name");

-- CreateIndex
CREATE INDEX "LedgerEntry_accountId_date_idx" ON "LedgerEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_invoiceId_idx" ON "LedgerEntry"("invoiceId");

-- CreateIndex
CREATE INDEX "LedgerAllocation_targetEntryId_idx" ON "LedgerAllocation"("targetEntryId");

-- CreateIndex
CREATE INDEX "LedgerAllocation_paymentEntryId_idx" ON "LedgerAllocation"("paymentEntryId");

-- CreateIndex
CREATE INDEX "AuditTrail_entityType_entityId_idx" ON "AuditTrail"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "CbmsSyncLog_invoiceId_attemptedAt_idx" ON "CbmsSyncLog"("invoiceId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuType" ADD CONSTRAINT "MenuType_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuType" ADD CONSTRAINT "MenuType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MenuSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "MenuType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockBatch" ADD CONSTRAINT "InventoryStockBatch_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockBatch" ADD CONSTRAINT "InventoryStockBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockBatch" ADD CONSTRAINT "InventoryStockBatch_inventoryCategoryId_fkey" FOREIGN KEY ("inventoryCategoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_inventoryCategoryId_fkey" FOREIGN KEY ("inventoryCategoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "InventoryItemType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemRecipeIngredient" ADD CONSTRAINT "MenuItemRecipeIngredient_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemRecipeIngredient" ADD CONSTRAINT "MenuItemRecipeIngredient_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemRecipeIngredient" ADD CONSTRAINT "MenuItemRecipeIngredient_inventoryCategoryId_fkey" FOREIGN KEY ("inventoryCategoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableArea" ADD CONSTRAINT "TableArea_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableArea" ADD CONSTRAINT "TableArea_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderItem" ADD CONSTRAINT "PosOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotTicket" ADD CONSTRAINT "KotTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotTicketItem" ADD CONSTRAINT "KotTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KotTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KotTicketItem" ADD CONSTRAINT "KotTicketItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "PosOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PosOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TableArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorLayout" ADD CONSTRAINT "FloorLayout_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TableArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorBlock" ADD CONSTRAINT "FloorBlock_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorZone" ADD CONSTRAINT "FloorZone_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorLine" ADD CONSTRAINT "FloorLine_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorText" ADD CONSTRAINT "FloorText_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "FloorLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Terminal" ADD CONSTRAINT "Terminal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalYear" ADD CONSTRAINT "FiscalYear_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "FiscalYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAgentRun" ADD CONSTRAINT "AiAgentRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiToolRun" ADD CONSTRAINT "AiToolRun_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AiAgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPart" ADD CONSTRAINT "PaymentPart_paymentReceiptId_fkey" FOREIGN KEY ("paymentReceiptId") REFERENCES "PaymentReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
