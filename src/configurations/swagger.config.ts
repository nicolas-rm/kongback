import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppConfigService } from '@/configurations/app-config.service';

export function configureSwagger(app: INestApplication): void {
    const config = app.get(AppConfigService);
    const documentConfig = new DocumentBuilder().setTitle(config.name).setDescription('Backend base API').setVersion('1.0').addBearerAuth().addCookieAuth('access_token').build();

    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('docs', app, document, {
        jsonDocumentUrl: 'docs/json',
    });
}
