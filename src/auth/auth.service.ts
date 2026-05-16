import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRoleName } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/cloudinary.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWorkspaceDto } from './dto/register-workspace.dto';
import { JwtPayload } from './types';

const DEFAULT_BRANCH_NAME = 'Main Branch';
const DEFAULT_BRANCH_CODE = 'MAIN';

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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async login(payload: LoginDto) {
    const identifier = payload.identifier.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        isDeleted: false,
        status: 'Active',
        OR: [
          {
            email: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
          {
            username: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
        ],
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        business: true,
        branch: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const passwordMatch = await bcrypt.compare(
      payload.password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const token = this.jwtService.sign(this.toJwtPayload(user));

    return {
      token,
      user: this.serializeUser(user),
      business: this.serializeBusiness(user.business),
      branch: user.branch,
      permissions: user.role.permissions,
    };
  }

  async register(payload: RegisterWorkspaceDto, logo?: Express.Multer.File) {
    if (payload.password !== payload.confirmPassword) {
      throw new UnauthorizedException('Passwords do not match.');
    }

    const email = payload.email.trim().toLowerCase();
    const phone = payload.phone?.trim();
    const businessName = payload.businessName.trim();
    const businessType = payload.businessType.trim();
    const firstName = payload.firstName.trim();
    const middleName = payload.middleName?.trim() || null;
    const lastName = payload.lastName.trim();

    let logoUrl: string | null = null;

    if (logo) {
      const upload = await this.cloudinary.uploadBusinessLogo(logo);
      logoUrl = upload.secure_url;
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: businessName,
          businessType,
          phone,
          email,
          logoUrl,
        },
      });

      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: DEFAULT_BRANCH_NAME,
          code: DEFAULT_BRANCH_CODE,
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
        const role = await tx.role.create({
          data: {
            businessId: business.id,
            name: roleName,
            description: `${roleName} role`,
            isSystemRole: true,
          },
        });

        roles.set(roleName, role);

        const rolePermissions = permissionsForRole(roleName);

        for (const permission of rolePermissions) {
          await tx.rolePermission.create({
            data: {
              roleId: role.id,
              ...permission,
            },
          });
        }
      }

      const ownerRole = roles.get('Owner');

      if (!ownerRole) {
        throw new UnauthorizedException('Owner role was not created.');
      }

      const username = await this.generateUsername(tx, business.id, email);

      const owner = await tx.user.create({
        data: {
          businessId: business.id,
          branchId: branch.id,
          roleId: ownerRole.id,
          firstName,
          middleName,
          lastName,
          username,
          phone,
          email,
          passwordHash,
          status: 'Active',
          mustChangePassword: false,
          maxDiscountPercent: 100,
        },
      });

      return { business, branch, owner };
    });

    const token = this.jwtService.sign(this.toJwtPayload(result.owner));

    return {
      token,
      user: this.serializeUser(result.owner),
      business: this.serializeBusiness(result.business),
      branch: result.branch,
    };
  }

  async getProfile(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
        business: true,
        branch: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return {
      user: this.serializeUser(user),
      business: this.serializeBusiness(user.business),
      branch: user.branch,
      permissions: user.role.permissions,
    };
  }

  private toJwtPayload(user: { id: string; businessId: string; branchId: string | null; roleId: string; username: string; email: string | null }) {
    return {
      sub: user.id,
      businessId: user.businessId,
      branchId: user.branchId,
      username: user.username,
      email: user.email,
    } satisfies JwtPayload;
  }

  private serializeUser(user: Prisma.UserGetPayload<{ include: { role: true } }>) {
    return {
      id: user.id,
      businessId: user.businessId,
      branchId: user.branchId,
      role: user.role.name,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      phone: user.phone,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private serializeBusiness(business: Prisma.BusinessGetPayload<{}>) {
    return {
      id: business.id,
      name: business.name,
      businessType: business.businessType,
      phone: business.phone,
      email: business.email,
      logoUrl: business.logoUrl,
      timezone: business.timezone,
      defaultCurrency: business.defaultCurrency,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    };
  }

  private async generateUsername(
    tx: Prisma.TransactionClient,
    businessId: string,
    email: string,
  ) {
    const base = email.split('@')[0]?.replace(/\s+/g, '').toLowerCase() || 'owner';
    let candidate = base;
    let suffix = 0;

    while (true) {
      const existing = await tx.user.findFirst({
        where: {
          businessId,
          username: candidate,
        },
      });

      if (!existing) {
        return candidate;
      }

      suffix += 1;
      candidate = `${base}${suffix}`;
    }
  }
}
