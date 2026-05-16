import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CanvasSizeType,
  FloorBlockType,
  FloorLayoutColor,
  FloorLineStyle,
  FloorTextAlign,
  FloorTextWeight,
  Prisma,
  RestaurantTableShape,
  RestaurantTableStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { CreateTableAreaDto } from './dto/create-table-area.dto';
import { SaveFloorLayoutDto } from './dto/save-floor-layout.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { UpdateTableAreaDto } from './dto/update-table-area.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';
const DEMO_BRANCH_CODE = 'BHR';

type AreaRecord = Prisma.TableAreaGetPayload<{
  include: {
    layout: true;
  };
}>;

type TableRecord = Prisma.RestaurantTableGetPayload<{
  include: {
    area: true;
  };
}>;

type LayoutRecord = Prisma.FloorLayoutGetPayload<{
  include: {
    blocks: true;
    zones: true;
    lines: true;
    texts: true;
  };
}>;

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  private decimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ) {
    if (value === null || value === undefined) return null;
    return Number(value);
  }

  private async getDemoContext(tx: Prisma.TransactionClient = this.prisma) {
    const business = await tx.business.findUnique({
      where: {
        id: DEMO_BUSINESS_ID,
      },
    });

    if (!business) {
      throw new NotFoundException('Demo business was not found.');
    }

    const branch = await tx.branch.findFirst({
      where: {
        businessId: business.id,
        code: DEMO_BRANCH_CODE,
        isActive: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Demo branch was not found.');
    }

    return {
      businessId: business.id,
      branchId: branch.id,
    };
  }

  private toTableStatus(value?: string | null) {
    if (!value) return RestaurantTableStatus.Free;

    const normalized = value.toLowerCase();

    if (normalized === 'occupied') return RestaurantTableStatus.Occupied;
    if (normalized === 'reserved') return RestaurantTableStatus.Reserved;

    return RestaurantTableStatus.Free;
  }

  private toTableShape(value?: string | null) {
    if (value === 'square') return RestaurantTableShape.square;
    if (value === 'rectangle') return RestaurantTableShape.rectangle;

    return RestaurantTableShape.round;
  }

  private toCanvasType(value?: string | null) {
    if (value === 'square') return CanvasSizeType.square;
    if (value === 'wide') return CanvasSizeType.wide;
    if (value === 'tall') return CanvasSizeType.tall;
    if (value === 'custom') return CanvasSizeType.custom;

    return CanvasSizeType.standard;
  }

  private toBlockType(value?: string | null) {
    switch (value) {
      case 'wall':
        return FloorBlockType.wall;
      case 'pillar':
        return FloorBlockType.pillar;
      case 'counter':
        return FloorBlockType.counter;
      case 'cashier':
        return FloorBlockType.cashier;
      case 'kitchen':
        return FloorBlockType.kitchen;
      case 'bar':
        return FloorBlockType.bar;
      case 'door':
        return FloorBlockType.door;
      case 'washroom':
        return FloorBlockType.washroom;
      case 'service':
        return FloorBlockType.service;
      case 'waiting':
        return FloorBlockType.waiting;
      case 'plant':
        return FloorBlockType.plant;
      default:
        return FloorBlockType.custom;
    }
  }

  private toLayoutColor(value?: string | null) {
    switch (value) {
      case 'zinc':
        return FloorLayoutColor.zinc;
      case 'stone':
        return FloorLayoutColor.stone;
      case 'violet':
        return FloorLayoutColor.violet;
      case 'indigo':
        return FloorLayoutColor.indigo;
      case 'blue':
        return FloorLayoutColor.blue;
      case 'sky':
        return FloorLayoutColor.sky;
      case 'cyan':
        return FloorLayoutColor.cyan;
      case 'teal':
        return FloorLayoutColor.teal;
      case 'emerald':
        return FloorLayoutColor.emerald;
      case 'green':
        return FloorLayoutColor.green;
      case 'amber':
        return FloorLayoutColor.amber;
      case 'orange':
        return FloorLayoutColor.orange;
      case 'red':
        return FloorLayoutColor.red;
      case 'rose':
        return FloorLayoutColor.rose;
      case 'pink':
        return FloorLayoutColor.pink;
      default:
        return FloorLayoutColor.slate;
    }
  }

  private toLineStyle(value?: string | null) {
    if (value === 'dashed') return FloorLineStyle.dashed;
    if (value === 'dotted') return FloorLineStyle.dotted;

    return FloorLineStyle.solid;
  }

  private toTextWeight(value?: string | null) {
    if (value === 'normal') return FloorTextWeight.normal;
    if (value === 'black') return FloorTextWeight.black;

    return FloorTextWeight.bold;
  }

  private toTextAlign(value?: string | null) {
    if (value === 'left') return FloorTextAlign.left;
    if (value === 'right') return FloorTextAlign.right;

    return FloorTextAlign.center;
  }
  private async ensureDefaultAreaExists(businessId: string, branchId: string) {
    const existingArea = await this.prisma.tableArea.findFirst({
      where: {
        businessId,
        branchId,
        isDeleted: false,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    if (existingArea) return existingArea;

    return this.prisma.$transaction(async (tx) => {
      const deletedMainHall = await tx.tableArea.findFirst({
        where: {
          businessId,
          branchId,
          isDeleted: true,
          name: {
            equals: 'Main Hall',
            mode: 'insensitive',
          },
        },
        include: {
          layout: true,
        },
      });

      if (deletedMainHall) {
        const restoredArea = await tx.tableArea.update({
          where: {
            id: deletedMainHall.id,
          },
          data: {
            description:
              deletedMainHall.description || 'Default dine-in section',
            sortOrder: 1,
            isActive: true,
            isDeleted: false,
          },
          include: {
            layout: true,
          },
        });

        if (!restoredArea.layout) {
          await tx.floorLayout.create({
            data: {
              businessId,
              branchId,
              areaId: restoredArea.id,
              canvasType: CanvasSizeType.standard,
              width: 1200,
              height: 720,
            },
          });
        }

        return restoredArea;
      }

      const area = await tx.tableArea.create({
        data: {
          businessId,
          branchId,
          name: 'Main Hall',
          description: 'Default dine-in section',
          sortOrder: 1,
          isActive: true,
          isDeleted: false,
        },
      });

      await tx.floorLayout.create({
        data: {
          businessId,
          branchId,
          areaId: area.id,
          canvasType: CanvasSizeType.standard,
          width: 1200,
          height: 720,
        },
      });

      return area;
    });
  }
  private serializeArea(area: AreaRecord) {
    return {
      id: area.id,
      businessId: area.businessId,
      branchId: area.branchId,
      name: area.name,
      description: area.description,
      sortOrder: area.sortOrder,
      isActive: area.isActive,
      isDeleted: area.isDeleted,
      canvasSize: area.layout
        ? {
            type: area.layout.canvasType,
            width: area.layout.width,
            height: area.layout.height,
          }
        : {
            type: 'standard',
            width: 1200,
            height: 720,
          },
      createdAt: area.createdAt,
      updatedAt: area.updatedAt,
    };
  }

  private serializeTable(table: TableRecord) {
    return {
      id: table.id,
      businessId: table.businessId,
      branchId: table.branchId,
      areaId: table.areaId,
      areaName: table.area.name,
      name: table.name,
      seats: table.seats,
      shape: table.shape,
      status: table.status,
      x: this.decimalToNumber(table.x),
      y: this.decimalToNumber(table.y),
      width: this.decimalToNumber(table.width),
      height: this.decimalToNumber(table.height),
      activeOrderId: table.activeOrderId,
      activeOrderNumber: table.activeOrderNumber,
      currentGuests: table.currentGuests,
      currentAmount: this.decimalToNumber(table.currentAmount),
      lastOrderAt: table.lastOrderAt,
      reservation:
        table.reservationName || table.reservationPhone
          ? {
              customerName: table.reservationName,
              phone: table.reservationPhone,
              guests: table.reservationGuests,
              reservationTime: table.reservationTime,
              note: table.reservationNote,
            }
          : null,
      isActive: table.isActive,
      isDeleted: table.isDeleted,
      createdAt: table.createdAt,
      updatedAt: table.updatedAt,
    };
  }

  private serializeLayout(layout: LayoutRecord) {
    return {
      id: layout.id,
      businessId: layout.businessId,
      branchId: layout.branchId,
      areaId: layout.areaId,
      canvasSize: {
        type: layout.canvasType,
        width: layout.width,
        height: layout.height,
      },
      blocks: layout.blocks.map((block) => ({
        id: block.id,
        areaId: block.areaId,
        label: block.label,
        blockType: block.blockType,
        color: block.color,
        showLabel: block.showLabel,
        x: this.decimalToNumber(block.x),
        y: this.decimalToNumber(block.y),
        width: this.decimalToNumber(block.width),
        height: this.decimalToNumber(block.height),
      })),
      zones: layout.zones.map((zone) => ({
        id: zone.id,
        areaId: zone.areaId,
        name: zone.name,
        color: zone.color,
        opacity: this.decimalToNumber(zone.opacity),
        showLabel: zone.showLabel,
        x: this.decimalToNumber(zone.x),
        y: this.decimalToNumber(zone.y),
        width: this.decimalToNumber(zone.width),
        height: this.decimalToNumber(zone.height),
      })),
      lines: layout.lines.map((line) => ({
        id: line.id,
        areaId: line.areaId,
        x1: this.decimalToNumber(line.x1),
        y1: this.decimalToNumber(line.y1),
        x2: this.decimalToNumber(line.x2),
        y2: this.decimalToNumber(line.y2),
        thickness: line.thickness,
        color: line.color,
        style: line.style,
      })),
      texts: layout.texts.map((text) => ({
        id: text.id,
        areaId: text.areaId,
        text: text.text,
        color: text.color,
        fontSize: text.fontSize,
        fontWeight: text.fontWeight,
        align: text.align,
        background: text.background,
        x: this.decimalToNumber(text.x),
        y: this.decimalToNumber(text.y),
        width: this.decimalToNumber(text.width),
        height: this.decimalToNumber(text.height),
      })),
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt,
    };
  }

  async getAreas(includeInactive = false) {
    const { businessId, branchId } = await this.getDemoContext();

    await this.ensureDefaultAreaExists(businessId, branchId);

    const areas = await this.prisma.tableArea.findMany({
      where: {
        businessId,
        branchId,
        isDeleted: false,
        isActive: includeInactive ? undefined : true,
      },
      include: {
        layout: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return areas.map((area) => this.serializeArea(area));
  }

  async createArea(payload: CreateTableAreaDto) {
    const { businessId, branchId } = await this.getDemoContext();

    const cleanName = payload.name.trim();
    const cleanDescription =
      payload.description?.trim() || 'Custom restaurant area';

    if (!cleanName) {
      throw new BadRequestException('Area name is required.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const activeAreaWithSameName = await tx.tableArea.findFirst({
        where: {
          businessId,
          branchId,
          isDeleted: false,
          name: {
            equals: cleanName,
            mode: 'insensitive',
          },
        },
      });

      if (activeAreaWithSameName) {
        throw new BadRequestException(
          'A table area with this name already exists.',
        );
      }

      const deletedAreaWithSameName = await tx.tableArea.findFirst({
        where: {
          businessId,
          branchId,
          isDeleted: true,
          name: {
            equals: cleanName,
            mode: 'insensitive',
          },
        },
        include: {
          layout: true,
        },
      });

      if (deletedAreaWithSameName) {
        const restoredArea = await tx.tableArea.update({
          where: {
            id: deletedAreaWithSameName.id,
          },
          data: {
            name: cleanName,
            description: cleanDescription,
            sortOrder:
              payload.sortOrder ?? deletedAreaWithSameName.sortOrder ?? 0,
            isActive: payload.isActive ?? true,
            isDeleted: false,
          },
          include: {
            layout: true,
          },
        });

        if (!restoredArea.layout) {
          await tx.floorLayout.create({
            data: {
              businessId,
              branchId,
              areaId: restoredArea.id,
              canvasType: CanvasSizeType.standard,
              width: 1200,
              height: 720,
            },
          });
        }

        return tx.tableArea.findUniqueOrThrow({
          where: {
            id: restoredArea.id,
          },
          include: {
            layout: true,
          },
        });
      }

      const area = await tx.tableArea.create({
        data: {
          businessId,
          branchId,
          name: cleanName,
          description: cleanDescription,
          sortOrder: payload.sortOrder ?? 0,
          isActive: payload.isActive ?? true,
          isDeleted: false,
        },
      });

      await tx.floorLayout.create({
        data: {
          businessId,
          branchId,
          areaId: area.id,
          canvasType: CanvasSizeType.standard,
          width: 1200,
          height: 720,
        },
      });

      return tx.tableArea.findUniqueOrThrow({
        where: {
          id: area.id,
        },
        include: {
          layout: true,
        },
      });
    });

    return this.serializeArea(created);
  }

  async updateArea(id: string, payload: UpdateTableAreaDto) {
    const { businessId, branchId } = await this.getDemoContext();

    const existing = await this.prisma.tableArea.findFirst({
      where: {
        id,
        businessId,
        branchId,
        isDeleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Table area was not found.');
    }

    if (payload.isActive === false && existing.isActive) {
      const activeAreaCount = await this.prisma.tableArea.count({
        where: {
          businessId,
          branchId: existing.branchId,
          isDeleted: false,
          isActive: true,
        },
      });

      if (activeAreaCount <= 1) {
        throw new BadRequestException(
          'At least one active table area is required.',
        );
      }
    }

    const cleanName = payload.name?.trim();

    if (payload.name !== undefined && !cleanName) {
      throw new BadRequestException('Area name is required.');
    }

    if (cleanName && cleanName.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicateArea = await this.prisma.tableArea.findFirst({
        where: {
          businessId,
          branchId,
          isDeleted: false,
          id: {
            not: id,
          },
          name: {
            equals: cleanName,
            mode: 'insensitive',
          },
        },
      });

      if (duplicateArea) {
        throw new BadRequestException(
          'A table area with this name already exists.',
        );
      }
    }

    const updated = await this.prisma.tableArea.update({
      where: {
        id,
      },
      data: {
        name: cleanName || undefined,
        description:
          payload.description === undefined
            ? undefined
            : payload.description.trim(),
        sortOrder: payload.sortOrder,
        isActive: payload.isActive,
      },
      include: {
        layout: true,
      },
    });

    return this.serializeArea(updated);
  }
  async deleteArea(id: string) {
    const { businessId, branchId } = await this.getDemoContext();

    const existing = await this.prisma.tableArea.findFirst({
      where: {
        id,
        businessId,
        branchId,
        isDeleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Table area was not found.');
    }

    const activeAreaCount = await this.prisma.tableArea.count({
      where: {
        businessId,
        branchId,
        isDeleted: false,
        isActive: true,
      },
    });

    if (activeAreaCount <= 1) {
      throw new BadRequestException('At least one table area is required.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.restaurantTable.updateMany({
        where: {
          businessId,
          branchId,
          areaId: id,
          isDeleted: false,
        },
        data: {
          isActive: false,
          isDeleted: true,
        },
      });

      await tx.tableArea.update({
        where: {
          id,
        },
        data: {
          isActive: false,
          isDeleted: true,
        },
      });
    });

    return {
      status: 'success',
      deletedAreaId: id,
    };
  }

  async getTables() {
    const { businessId, branchId } = await this.getDemoContext();

    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        businessId,
        branchId,
        isDeleted: false,
      },
      include: {
        area: true,
      },
      orderBy: [{ areaId: 'asc' }, { name: 'asc' }],
    });

    return tables.map((table) => this.serializeTable(table));
  }

  async createTable(payload: CreateRestaurantTableDto) {
    const { businessId, branchId } = await this.getDemoContext();

    const area = await this.prisma.tableArea.findFirst({
      where: {
        id: payload.areaId,
        businessId,
        branchId,
        isDeleted: false,
        isActive: true,
      },
    });

    if (!area) {
      throw new NotFoundException('Table area was not found.');
    }

    const cleanName = payload.name.trim();

    if (!cleanName) {
      throw new BadRequestException('Table name is required.');
    }

    const created = await this.prisma.restaurantTable.create({
      data: {
        businessId,
        branchId,
        areaId: area.id,
        name: cleanName,
        seats: payload.seats ?? 4,
        shape: this.toTableShape(payload.shape),
        status: this.toTableStatus(payload.status),
        x: payload.x ?? 10,
        y: payload.y ?? 10,
        width: payload.width ?? 9,
        height: payload.height ?? 13,
        reservationName: payload.reservationName?.trim(),
        reservationPhone: payload.reservationPhone?.trim(),
        reservationGuests: payload.reservationGuests,
        reservationTime: payload.reservationTime?.trim(),
        reservationNote: payload.reservationNote?.trim(),
      },
      include: {
        area: true,
      },
    });

    return this.serializeTable(created);
  }

  async updateTable(id: string, payload: UpdateRestaurantTableDto) {
    const { businessId, branchId } = await this.getDemoContext();

    const existing = await this.prisma.restaurantTable.findFirst({
      where: {
        id,
        businessId,
        branchId,
        isDeleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Restaurant table was not found.');
    }

    if (payload.areaId) {
      const area = await this.prisma.tableArea.findFirst({
        where: {
          id: payload.areaId,
          businessId,
          branchId,
          isDeleted: false,
          isActive: true,
        },
      });

      if (!area) {
        throw new NotFoundException('Table area was not found.');
      }
    }

    const updated = await this.prisma.restaurantTable.update({
      where: {
        id,
      },
      data: {
        areaId: payload.areaId,
        name: payload.name?.trim() || undefined,
        seats: payload.seats,
        shape: payload.shape ? this.toTableShape(payload.shape) : undefined,
        status: payload.status ? this.toTableStatus(payload.status) : undefined,
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
        activeOrderId: payload.activeOrderId,
        activeOrderNumber: payload.activeOrderNumber,
        currentGuests: payload.currentGuests,
        currentAmount: payload.currentAmount,
        lastOrderAt:
          payload.status && this.toTableStatus(payload.status) === 'Occupied'
            ? new Date()
            : undefined,
        reservationName: payload.reservationName,
        reservationPhone: payload.reservationPhone,
        reservationGuests: payload.reservationGuests,
        reservationTime: payload.reservationTime,
        reservationNote: payload.reservationNote,
        isActive: payload.isActive,
      },
      include: {
        area: true,
      },
    });

    return this.serializeTable(updated);
  }

  async deleteTable(id: string) {
    const { businessId, branchId } = await this.getDemoContext();

    const existing = await this.prisma.restaurantTable.findFirst({
      where: {
        id,
        businessId,
        branchId,
        isDeleted: false,
      },
    });

    if (!existing) {
      throw new NotFoundException('Restaurant table was not found.');
    }

    await this.prisma.restaurantTable.update({
      where: {
        id,
      },
      data: {
        isActive: false,
        isDeleted: true,
      },
    });

    return {
      status: 'success',
      deletedTableId: id,
    };
  }

  async getFloorLayout(areaId: string) {
    const { businessId, branchId } = await this.getDemoContext();

    const area = await this.prisma.tableArea.findFirst({
      where: {
        id: areaId,
        businessId,
        branchId,
        isDeleted: false,
        isActive: true,
      },
    });

    if (!area) {
      throw new NotFoundException('Table area was not found.');
    }

    const layout =
      (await this.prisma.floorLayout.findUnique({
        where: {
          areaId,
        },
        include: {
          blocks: true,
          zones: true,
          lines: true,
          texts: true,
        },
      })) ??
      (await this.prisma.floorLayout.create({
        data: {
          businessId,
          branchId,
          areaId,
          canvasType: CanvasSizeType.standard,
          width: 1200,
          height: 720,
        },
        include: {
          blocks: true,
          zones: true,
          lines: true,
          texts: true,
        },
      }));

    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        businessId,
        branchId,
        areaId,
        isDeleted: false,
      },
      include: {
        area: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      ...this.serializeLayout(layout),
      tables: tables.map((table) => this.serializeTable(table)),
    };
  }

  async saveFloorLayout(areaId: string, payload: SaveFloorLayoutDto) {
    const { businessId, branchId } = await this.getDemoContext();

    const area = await this.prisma.tableArea.findFirst({
      where: {
        id: areaId,
        businessId,
        branchId,
        isDeleted: false,
        isActive: true,
      },
    });
    if (!area) {
      throw new NotFoundException('Table area was not found.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const layout = await tx.floorLayout.upsert({
        where: {
          areaId,
        },
        update: {
          businessId,
          branchId,
          canvasType: this.toCanvasType(payload.canvasSize.type),
          width: payload.canvasSize.width,
          height: payload.canvasSize.height,
        },
        create: {
          businessId,
          branchId,
          areaId,
          canvasType: this.toCanvasType(payload.canvasSize.type),
          width: payload.canvasSize.width,
          height: payload.canvasSize.height,
        },
      });

      await tx.floorBlock.deleteMany({
        where: {
          layoutId: layout.id,
        },
      });

      await tx.floorZone.deleteMany({
        where: {
          layoutId: layout.id,
        },
      });

      await tx.floorLine.deleteMany({
        where: {
          layoutId: layout.id,
        },
      });

      await tx.floorText.deleteMany({
        where: {
          layoutId: layout.id,
        },
      });

      const incomingTableIds = payload.tables
        .map((table) => table.id)
        .filter((id): id is string => Boolean(id));

      await tx.restaurantTable.updateMany({
        where: {
          businessId,
          branchId,
          areaId,
          isDeleted: false,
          id:
            incomingTableIds.length > 0
              ? {
                  notIn: incomingTableIds,
                }
              : undefined,
        },
        data: {
          isActive: false,
          isDeleted: true,
        },
      });

      for (const table of payload.tables) {
        const tableData = {
          businessId,
          branchId,
          areaId,
          name: table.name.trim(),
          seats: table.seats,
          shape: this.toTableShape(table.shape),
          status: this.toTableStatus(table.status),
          x: table.x,
          y: table.y,
          width: table.width,
          height: table.height,
          isActive: true,
          isDeleted: false,
        };

        if (table.id) {
          const updated = await tx.restaurantTable.updateMany({
            where: {
              id: table.id,
              businessId,
            },
            data: tableData,
          });

          if (updated.count > 0) continue;
        }

        await tx.restaurantTable.create({
          data: {
            id: table.id,
            ...tableData,
          },
        });
      }

      if (payload.blocks.length > 0) {
        await tx.floorBlock.createMany({
          data: payload.blocks.map((block) => ({
            layoutId: layout.id,
            areaId,
            label: block.label.trim(),
            blockType: this.toBlockType(block.blockType),
            color: this.toLayoutColor(block.color),
            showLabel: block.showLabel,
            x: block.x,
            y: block.y,
            width: block.width,
            height: block.height,
          })),
        });
      }

      if (payload.zones.length > 0) {
        await tx.floorZone.createMany({
          data: payload.zones.map((zone) => ({
            layoutId: layout.id,
            areaId,
            name: zone.name.trim(),
            color: this.toLayoutColor(zone.color),
            opacity: zone.opacity ?? 0.16,
            showLabel: zone.showLabel,
            x: zone.x,
            y: zone.y,
            width: zone.width,
            height: zone.height,
          })),
        });
      }

      if (payload.lines.length > 0) {
        await tx.floorLine.createMany({
          data: payload.lines.map((line) => ({
            layoutId: layout.id,
            areaId,
            x1: line.x1,
            y1: line.y1,
            x2: line.x2,
            y2: line.y2,
            thickness: line.thickness,
            color: this.toLayoutColor(line.color),
            style: this.toLineStyle(line.style),
          })),
        });
      }

      if (payload.texts.length > 0) {
        await tx.floorText.createMany({
          data: payload.texts.map((text) => ({
            layoutId: layout.id,
            areaId,
            text: text.text,
            color: this.toLayoutColor(text.color),
            fontSize: text.fontSize,
            fontWeight: this.toTextWeight(text.fontWeight),
            align: this.toTextAlign(text.align),
            background: text.background,
            x: text.x,
            y: text.y,
            width: text.width,
            height: text.height,
          })),
        });
      }

      return tx.floorLayout.findUniqueOrThrow({
        where: {
          areaId,
        },
        include: {
          blocks: true,
          zones: true,
          lines: true,
          texts: true,
        },
      });
    });

    const tables = await this.prisma.restaurantTable.findMany({
      where: {
        businessId,
        branchId,
        areaId,
        isDeleted: false,
      },
      include: {
        area: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return {
      ...this.serializeLayout(result),
      tables: tables.map((table) => this.serializeTable(table)),
    };
  }
}
