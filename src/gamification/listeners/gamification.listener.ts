import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  TransactionCreatedEvent,
  GoalContributedEvent,
  MissionCompletedEvent,
} from '../../common/events/gamification.events';
import { GamificationService } from '../gamification.service';
import { MissionsService } from '../missions.service';

@Injectable()
export class GamificationListener {
  private readonly logger = new Logger(GamificationListener.name);

  constructor(
    private readonly gamificationService: GamificationService,
    private readonly missionsService: MissionsService,
  ) {}

  @OnEvent('transaction.created', { async: true })
  async handleTransactionCreated(event: TransactionCreatedEvent) {
    this.logger.log(`Handling transaction created for user ${event.userId}`);

    // Award XP
    await this.gamificationService.awardXp(
      event.userId,
      10,
      'Transaction Created',
    );

    // Update Streak
    await this.gamificationService.updateStreak(event.userId);

    // Update Missions
    await this.missionsService.updateMissionProgress(
      event.userId,
      'TRANSACTION_COUNT',
    );
  }

  @OnEvent('goal.contributed', { async: true })
  async handleGoalContributed(event: GoalContributedEvent) {
    this.logger.log(`Handling goal contribution for user ${event.userId}`);

    // Award XP (Higher reward)
    await this.gamificationService.awardXp(
      event.userId,
      50,
      'Goal Contributed',
    );

    // Update Missions
    await this.missionsService.updateMissionProgress(
      event.userId,
      'GOAL_CONTRIBUTION',
    );
  }

  @OnEvent('mission.completed', { async: true })
  async handleMissionCompleted(event: MissionCompletedEvent) {
    this.logger.log(
      `Handling mission completion for user ${event.userId} (+${event.xpReward} XP)`,
    );

    // Credita o XP da missão concluída
    await this.gamificationService.awardXp(
      event.userId,
      event.xpReward,
      'Mission Completed',
    );
  }
}
