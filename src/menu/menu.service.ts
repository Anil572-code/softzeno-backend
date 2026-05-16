import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MenuItemStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { CreateMenuSectionDto } from './dto/create-menu-section.dto';
import { CreateMenuTypeDto } from './dto/create-menu-type.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { UpdateMenuItemStatusDto } from './dto/update-menu-item-status.dto';
import { UpdateMenuSectionDto } from './dto/update-menu-section.dto';
import { UpdateMenuTypeDto } from './dto/update-menu-type.dto';

const DEMO_BUSINESS_ID = 'softzeno-demo-business';

type MenuItemWithRelations = Prisma.MenuItemGetPayload<{
  include: {
    section: true;
    category: true;
    type: true;
  };
}>;

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getSections(query: { businessId?: string; includeInactive?: boolean }) {
    const businessId = this.getBusinessId(query.businessId);

    return this.prisma.menuSection.findMany({
      where: {
        businessId,
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createSection(dto: CreateMenuSectionDto) {
    const businessId = this.getBusinessId(dto.businessId);
    const name = this.clean(dto.name);

    if (!name) {
      throw new BadRequestException('Section name is required.');
    }

    const existing = await this.prisma.menuSection.findFirst({
      where: { businessId, name },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.menuSection.create({
      data: {
        businessId,
        name,
        kotDestination: this.clean(dto.kotDestination) || name,
        sortOrder: this.toInteger(dto.sortOrder, 0),
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSection(id: string, dto: UpdateMenuSectionDto) {
    const existing = await this.prisma.menuSection.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Menu section not found.');
    }

    const data: Prisma.MenuSectionUpdateInput = {};

    if (dto.name !== undefined) {
      const name = this.clean(dto.name);
      if (!name) throw new BadRequestException('Section name cannot be empty.');
      data.name = name;
    }

    if (dto.kotDestination !== undefined) {
      data.kotDestination =
        this.clean(dto.kotDestination) || existing.kotDestination;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = this.toInteger(dto.sortOrder, existing.sortOrder);
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.menuSection.update({
      where: { id },
      data,
    });
  }

  async getCategories(query: {
    businessId?: string;
    sectionId?: string;
    includeInactive?: boolean;
  }) {
    const businessId = this.getBusinessId(query.businessId);

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        businessId,
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      include: {
        section: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => ({
      id: category.id,
      businessId: category.businessId,
      sectionId: category.sectionId,
      sectionName: category.section.name,
      name: category.name,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }));
  }

  async createCategory(dto: CreateMenuCategoryDto) {
    const businessId = this.getBusinessId(dto.businessId);
    const name = this.clean(dto.name);

    if (!name) {
      throw new BadRequestException('Category name is required.');
    }

    const section = await this.findActiveSection(businessId, dto.sectionId);

    const existing = await this.prisma.menuCategory.findFirst({
      where: {
        businessId,
        sectionId: section.id,
        name,
      },
      include: {
        section: true,
      },
    });

    if (existing) {
      return {
        id: existing.id,
        businessId: existing.businessId,
        sectionId: existing.sectionId,
        sectionName: existing.section.name,
        name: existing.name,
        sortOrder: existing.sortOrder,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    const created = await this.prisma.menuCategory.create({
      data: {
        businessId,
        sectionId: section.id,
        name,
        sortOrder: this.toInteger(dto.sortOrder, 0),
        isActive: dto.isActive ?? true,
      },
      include: {
        section: true,
      },
    });

    return {
      id: created.id,
      businessId: created.businessId,
      sectionId: created.sectionId,
      sectionName: created.section.name,
      name: created.name,
      sortOrder: created.sortOrder,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateCategory(id: string, dto: UpdateMenuCategoryDto) {
    const existing = await this.prisma.menuCategory.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Menu category not found.');
    }

    const data: Prisma.MenuCategoryUncheckedUpdateInput = {};

    if (dto.sectionId !== undefined) {
      const section = await this.findActiveSection(
        existing.businessId,
        dto.sectionId,
      );
      data.sectionId = section.id;
    }

    if (dto.name !== undefined) {
      const name = this.clean(dto.name);
      if (!name)
        throw new BadRequestException('Category name cannot be empty.');
      data.name = name;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = this.toInteger(dto.sortOrder, existing.sortOrder);
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.menuCategory.update({
      where: { id },
      data,
      include: {
        section: true,
      },
    });

    return {
      id: updated.id,
      businessId: updated.businessId,
      sectionId: updated.sectionId,
      sectionName: updated.section.name,
      name: updated.name,
      sortOrder: updated.sortOrder,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async getTypes(query: {
    businessId?: string;
    sectionId?: string;
    categoryId?: string;
    includeInactive?: boolean;
  }) {
    const businessId = this.getBusinessId(query.businessId);

    const types = await this.prisma.menuType.findMany({
      where: {
        businessId,
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      include: {
        section: true,
        category: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return types.map((type) => ({
      id: type.id,
      businessId: type.businessId,
      sectionId: type.sectionId,
      sectionName: type.section.name,
      categoryId: type.categoryId,
      categoryName: type.category.name,
      name: type.name,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    }));
  }

  async createType(dto: CreateMenuTypeDto) {
    const businessId = this.getBusinessId(dto.businessId);
    const name = this.clean(dto.name);

    if (!name) {
      throw new BadRequestException('Type name is required.');
    }

    const section = await this.findActiveSection(businessId, dto.sectionId);
    const category = await this.findActiveCategory(businessId, dto.categoryId);

    if (category.sectionId !== section.id) {
      throw new BadRequestException(
        'Selected category does not belong to selected section.',
      );
    }

    const existing = await this.prisma.menuType.findFirst({
      where: {
        businessId,
        categoryId: category.id,
        name,
      },
      include: {
        section: true,
        category: true,
      },
    });

    if (existing) {
      return this.toTypeResponse(existing);
    }

    const created = await this.prisma.menuType.create({
      data: {
        businessId,
        sectionId: section.id,
        categoryId: category.id,
        name,
        sortOrder: this.toInteger(dto.sortOrder, 0),
        isActive: dto.isActive ?? true,
      },
      include: {
        section: true,
        category: true,
      },
    });

    return this.toTypeResponse(created);
  }

  async updateType(id: string, dto: UpdateMenuTypeDto) {
    const existing = await this.prisma.menuType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Menu type not found.');
    }

    const nextSectionId = dto.sectionId ?? existing.sectionId;
    const nextCategoryId = dto.categoryId ?? existing.categoryId;

    const section = await this.findActiveSection(
      existing.businessId,
      nextSectionId,
    );
    const category = await this.findActiveCategory(
      existing.businessId,
      nextCategoryId,
    );

    if (category.sectionId !== section.id) {
      throw new BadRequestException(
        'Selected category does not belong to selected section.',
      );
    }

    const data: Prisma.MenuTypeUncheckedUpdateInput = {
      sectionId: section.id,
      categoryId: category.id,
    };

    if (dto.name !== undefined) {
      const name = this.clean(dto.name);
      if (!name) throw new BadRequestException('Type name cannot be empty.');
      data.name = name;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = this.toInteger(dto.sortOrder, existing.sortOrder);
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.menuType.update({
      where: { id },
      data,
      include: {
        section: true,
        category: true,
      },
    });

    return this.toTypeResponse(updated);
  }

  async getItems(query: {
    businessId?: string;
    includeUnavailable?: boolean;
    includeHidden?: boolean;
    sectionId?: string;
    categoryId?: string;
    typeId?: string;
  }) {
    const businessId = this.getBusinessId(query.businessId);

    const items = await this.prisma.menuItem.findMany({
      where: {
        businessId,
        isTrashed: false,
        ...(query.includeUnavailable
          ? {}
          : { status: MenuItemStatus.Available }),
        ...(query.includeHidden ? {} : { showInPOS: true }),
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.typeId ? { typeId: query.typeId } : {}),
      },
      include: {
        section: true,
        category: true,
        type: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return items.map((item) => this.toItemResponse(item));
  }

  async createItem(dto: CreateMenuItemDto) {
    const businessId = this.getBusinessId(dto.businessId);
    const name = this.clean(dto.name);

    if (!name) {
      throw new BadRequestException('Menu item name is required.');
    }

    const price = this.toMoney(dto.price);

    if (price <= 0) {
      throw new BadRequestException('Menu item price must be greater than 0.');
    }

    const chain = await this.validateMenuChain(
      businessId,
      dto.sectionId,
      dto.categoryId,
      dto.typeId,
    );

    const existing = await this.prisma.menuItem.findFirst({
      where: {
        businessId,
        typeId: chain.type.id,
        name,
        isTrashed: false,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Another active menu item already uses this name inside this type.',
      );
    }

    const created = await this.prisma.menuItem.create({
      data: {
        businessId,
        sectionId: chain.section.id,
        categoryId: chain.category.id,
        typeId: chain.type.id,
        name,
        price,
        costPrice: this.toMoney(dto.costPrice ?? 0),
        vatIncluded: dto.vatIncluded ?? true,
        kotDestination:
          this.clean(dto.kotDestination) || chain.section.kotDestination,
        status: dto.status ?? MenuItemStatus.Available,
        showInPOS: dto.showInPOS ?? true,
        stock: this.nullableInteger(dto.stock),
        lowStockLimit: this.nullableInteger(dto.lowStockLimit),
        description: this.clean(dto.description),
        imageUrl: this.clean(dto.imageUrl) || null,
        sortOrder: this.toInteger(dto.sortOrder, 0),
      },
      include: {
        section: true,
        category: true,
        type: true,
      },
    });

    return this.toItemResponse(created);
  }

  async updateItem(id: string, dto: UpdateMenuItemDto) {
    const existing = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existing || existing.isTrashed) {
      throw new NotFoundException('Menu item not found.');
    }

    const nextSectionId = dto.sectionId ?? existing.sectionId;
    const nextCategoryId = dto.categoryId ?? existing.categoryId;
    const nextTypeId = dto.typeId ?? existing.typeId;

    const chain = await this.validateMenuChain(
      existing.businessId,
      nextSectionId,
      nextCategoryId,
      nextTypeId,
    );

    const data: Prisma.MenuItemUncheckedUpdateInput = {
      sectionId: chain.section.id,
      categoryId: chain.category.id,
      typeId: chain.type.id,
    };

    if (dto.name !== undefined) {
      const name = this.clean(dto.name);
      if (!name)
        throw new BadRequestException('Menu item name cannot be empty.');
      data.name = name;
    }

    if (dto.price !== undefined) {
      const price = this.toMoney(dto.price);
      if (price <= 0)
        throw new BadRequestException(
          'Menu item price must be greater than 0.',
        );
      data.price = price;
    }

    if (dto.costPrice !== undefined) {
      data.costPrice = this.toMoney(dto.costPrice);
    }

    if (dto.vatIncluded !== undefined) {
      data.vatIncluded = dto.vatIncluded;
    }

    if (dto.kotDestination !== undefined) {
      data.kotDestination =
        this.clean(dto.kotDestination) || chain.section.kotDestination;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    if (dto.showInPOS !== undefined) {
      data.showInPOS = dto.showInPOS;
    }

    if (dto.stock !== undefined) {
      data.stock = this.nullableInteger(dto.stock);
    }

    if (dto.lowStockLimit !== undefined) {
      data.lowStockLimit = this.nullableInteger(dto.lowStockLimit);
    }

    if (dto.description !== undefined) {
      data.description = this.clean(dto.description);
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = this.clean(dto.imageUrl) || null;
    }

    if (dto.sortOrder !== undefined) {
      data.sortOrder = this.toInteger(dto.sortOrder, existing.sortOrder);
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data,
      include: {
        section: true,
        category: true,
        type: true,
      },
    });

    return this.toItemResponse(updated);
  }

  async updateItemStatus(id: string, dto: UpdateMenuItemStatusDto) {
    if (!Object.values(MenuItemStatus).includes(dto.status)) {
      throw new BadRequestException('Invalid menu item status.');
    }

    const existing = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existing || existing.isTrashed) {
      throw new NotFoundException('Menu item not found.');
    }

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        status: dto.status,
      },
      include: {
        section: true,
        category: true,
        type: true,
      },
    });

    return this.toItemResponse(updated);
  }

  async deleteItem(id: string) {
    const existing = await this.prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existing || existing.isTrashed) {
      throw new NotFoundException('Menu item not found.');
    }

    const deleted = await this.prisma.menuItem.update({
      where: { id },
      data: {
        isTrashed: true,
        showInPOS: false,
        status: MenuItemStatus.Unavailable,
      },
      include: {
        section: true,
        category: true,
        type: true,
      },
    });

    return {
      success: true,
      item: this.toItemResponse(deleted),
    };
  }

  private async validateMenuChain(
    businessId: string,
    sectionId: string,
    categoryId: string,
    typeId: string,
  ) {
    const section = await this.findActiveSection(businessId, sectionId);
    const category = await this.findActiveCategory(businessId, categoryId);
    const type = await this.findActiveType(businessId, typeId);

    if (category.sectionId !== section.id) {
      throw new BadRequestException(
        'Selected category does not belong to selected section.',
      );
    }

    if (type.sectionId !== section.id || type.categoryId !== category.id) {
      throw new BadRequestException(
        'Selected type does not belong to selected section/category.',
      );
    }

    return { section, category, type };
  }

  private async findActiveSection(businessId: string, sectionId: string) {
    const section = await this.prisma.menuSection.findFirst({
      where: {
        id: sectionId,
        businessId,
        isActive: true,
      },
    });

    if (!section) {
      throw new BadRequestException('Selected menu section was not found.');
    }

    return section;
  }

  private async findActiveCategory(businessId: string, categoryId: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: {
        id: categoryId,
        businessId,
        isActive: true,
      },
    });

    if (!category) {
      throw new BadRequestException('Selected menu category was not found.');
    }

    return category;
  }

  private async findActiveType(businessId: string, typeId: string) {
    const type = await this.prisma.menuType.findFirst({
      where: {
        id: typeId,
        businessId,
        isActive: true,
      },
    });

    if (!type) {
      throw new BadRequestException('Selected menu type was not found.');
    }

    return type;
  }

  private toTypeResponse(
    type: Prisma.MenuTypeGetPayload<{
      include: {
        section: true;
        category: true;
      };
    }>,
  ) {
    return {
      id: type.id,
      businessId: type.businessId,
      sectionId: type.sectionId,
      sectionName: type.section.name,
      categoryId: type.categoryId,
      categoryName: type.category.name,
      name: type.name,
      sortOrder: type.sortOrder,
      isActive: type.isActive,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  private toItemResponse(item: MenuItemWithRelations) {
    return {
      id: item.id,
      businessId: item.businessId,
      sectionId: item.sectionId,
      sectionName: item.section.name,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      typeId: item.typeId,
      typeName: item.type.name,
      name: item.name,
      price: Number(item.price),
      costPrice: Number(item.costPrice),
      vatIncluded: item.vatIncluded,
      kotDestination: item.kotDestination,
      status: item.status,
      showInPOS: item.showInPOS,
      stock: item.stock,
      lowStockLimit: item.lowStockLimit,
      description: item.description,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
      isTrashed: item.isTrashed,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private getBusinessId(businessId?: string | null) {
    return this.clean(businessId) || DEMO_BUSINESS_ID;
  }

  private clean(value?: string | null) {
    return String(value ?? '').trim();
  }

  private toMoney(value?: number | string | null) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.round((numericValue + Number.EPSILON) * 100) / 100;
  }

  private toInteger(value: unknown, fallback: number) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return fallback;
    }

    return Math.trunc(numericValue);
  }

  private nullableInteger(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return null;
    }

    return Math.trunc(numericValue);
  }
}
