import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterWorkspaceDto } from './dto/register-workspace.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Post('register')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: {
        fileSize: 600 * 1024,
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          return callback(
            new Error('Only image uploads are allowed for business logo.'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  register(
    @Body() payload: RegisterWorkspaceDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.authService.register(payload, logo);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return this.authService.getProfile(user);
  }
}
