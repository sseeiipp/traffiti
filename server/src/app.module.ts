import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module.js';
import { ChallengesController } from './challenges/challenges.controller.js';
import { ChallengesService } from './challenges/challenges.service.js';
import { CrewsController } from './crews/crews.controller.js';
import { CrewsService } from './crews/crews.service.js';
import { DbModule } from './db/db.module.js';
import { RankingsController } from './rankings/rankings.controller.js';
import { RankingsService } from './rankings/rankings.service.js';
import { RunsController } from './runs/runs.controller.js';
import { RunsService } from './runs/runs.service.js';
import { UsersController } from './users/users.controller.js';
import { PeopleController } from './users/people.controller.js';
import { UsersService } from './users/users.service.js';
import { HealthController } from './health.controller.js';
import { ImagesController } from './images/images.controller.js';

@Module({
  imports: [ScheduleModule.forRoot(), DbModule, AuthModule],
  controllers: [HealthController, ImagesController, UsersController, PeopleController, CrewsController, ChallengesController, RunsController, RankingsController],
  providers: [UsersService, CrewsService, ChallengesService, RunsService, RankingsService],
})
export class AppModule {}
