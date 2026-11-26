import { Mission, RegionId } from './types';
import { REGION_CENTERS } from './utils';

export function createInitialMissions(): Mission[] {
  return [
    {
      id: 'protect_village',
      title: 'Protect Kurokawa Village',
      region: 'village',
      giver: 'Elder Kenji',
      summary: 'Raiders have been spotted around the outskirts of Kurokawa Village. Drive them back.',
      xpReward: 120,
      goldReward: 45,
      status: 'active',
      objectives: [
        {
          id: 'defeat_village_bandits',
          description: 'Defeat scouting bandits near the village',
          current: 0,
          target: 3,
          completed: false,
          markerPos: { x: -22, z: 60 },
        },
      ],
    },
    {
      id: 'clear_bandit_camp',
      title: 'Clear the Crimson Skull Camp',
      region: 'bandit_camp',
      giver: 'Elder Kenji',
      summary: 'Strike the bandit stronghold to the southwest and defeat Takeshi the Bandit Chief.',
      xpReward: 200,
      goldReward: 80,
      status: 'available',
      objectives: [
        {
          id: 'defeat_camp_bandits',
          description: 'Eliminate bandits in Crimson Skull Camp',
          current: 0,
          target: 4,
          completed: false,
          markerPos: { x: -92, z: 86 },
        },
        {
          id: 'defeat_camp_boss',
          description: 'Defeat Takeshi the Bandit Chief',
          current: 0,
          target: 1,
          completed: false,
          markerPos: { x: -92, z: 89 },
        },
      ],
    },
    {
      id: 'rescue_villager',
      title: 'Rescue the Captured Villager',
      region: 'bandit_camp',
      giver: 'Village Blacksmith',
      summary: 'A villager is being held captive inside Crimson Skull Camp. Free them safely.',
      xpReward: 140,
      goldReward: 55,
      status: 'available',
      objectives: [
        {
          id: 'free_captive',
          description: 'Speak to and rescue the captured villager [E]',
          current: 0,
          target: 1,
          completed: false,
          markerPos: { x: -97, z: 93 },
        },
      ],
    },
    {
      id: 'explore_temple',
      title: 'Explore the Abandoned Temple',
      region: 'temple',
      giver: 'Shrine Scroll',
      summary: 'Cross the northern Torii gates and investigate the ruined Kiyomizu Temple.',
      xpReward: 130,
      goldReward: 50,
      status: 'available',
      objectives: [
        {
          id: 'reach_temple',
          description: 'Reach Kiyomizu Temple courtyard in the north',
          current: 0,
          target: 1,
          completed: false,
          markerPos: { x: REGION_CENTERS.temple.x, z: REGION_CENTERS.temple.z },
        },
      ],
    },
    {
      id: 'find_lost_katana',
      title: 'Find the Lost Katana',
      region: 'bamboo_forest',
      giver: 'Master Tetsuo',
      summary: 'Cross the eastern bridge into the Whispering Bamboo Grove and recover the ancestral blade.',
      xpReward: 180,
      goldReward: 75,
      status: 'available',
      objectives: [
        {
          id: 'claim_katana_relic',
          description: 'Retrieve the Ancestral Blade in the Bamboo Grove [E]',
          current: 0,
          target: 1,
          completed: false,
          markerPos: { x: 118, z: -12 },
        },
      ],
    },
    {
      id: 'defeat_rogue_samurai',
      title: 'Shadow of the Shogun',
      region: 'mountain_path',
      giver: 'Elder Kenji',
      summary: 'Ascend Kurogane Mountain Path in the northwest and duel Kuroda, the Rogue Samurai.',
      xpReward: 350,
      goldReward: 150,
      status: 'available',
      objectives: [
        {
          id: 'defeat_kuroda',
          description: 'Defeat Kuroda on Kurogane Mountain Path',
          current: 0,
          target: 1,
          completed: false,
          markerPos: { x: -110, z: -50 },
        },
      ],
    },
  ];
}

export class MissionManager {
  public missions: Mission[];
  public activeMissionId: string | null = 'protect_village';

  constructor(initial?: Mission[]) {
    this.missions = initial || createInitialMissions();
  }

  public get activeMission(): Mission | null {
    return this.missions.find((m) => m.id === this.activeMissionId) || null;
  }

  public get completedCount(): number {
    return this.missions.filter((m) => m.status === 'completed').length;
  }

  public get allCompleted(): boolean {
    return this.missions.every((m) => m.status === 'completed');
  }

  public selectNextMission(): void {
    const next = this.missions.find((m) => m.status === 'active') || this.missions.find((m) => m.status === 'available');
    if (next) {
      next.status = 'active';
      this.activeMissionId = next.id;
    } else {
      this.activeMissionId = null;
    }
  }

  public setActiveMission(id: string): void {
    const m = this.missions.find((x) => x.id === id);
    if (m && m.status !== 'completed') {
      m.status = 'active';
      this.activeMissionId = id;
    }
  }

  public getCurrentMarker(): { x: number; z: number } | undefined {
    const m = this.activeMission;
    if (!m) return undefined;
    const obj = m.objectives.find((o) => !o.completed);
    return obj?.markerPos;
  }

  public recordEnemyKill(missionTag?: string): Mission[] {
    const newlyCompleted: Mission[] = [];
    if (!missionTag) return newlyCompleted;

    if (missionTag === 'village_bandit') {
      this.advanceObjective('protect_village', 'defeat_village_bandits', 1, newlyCompleted);
    } else if (missionTag === 'camp_bandit') {
      this.advanceObjective('clear_bandit_camp', 'defeat_camp_bandits', 1, newlyCompleted);
    } else if (missionTag === 'camp_boss') {
      this.advanceObjective('clear_bandit_camp', 'defeat_camp_boss', 1, newlyCompleted);
    } else if (missionTag === 'rogue_boss') {
      this.advanceObjective('defeat_rogue_samurai', 'defeat_kuroda', 1, newlyCompleted);
    }

    return newlyCompleted;
  }

  public recordRegionEntered(region: RegionId): Mission[] {
    const newlyCompleted: Mission[] = [];
    if (region === 'temple') {
      this.advanceObjective('explore_temple', 'reach_temple', 1, newlyCompleted);
    }
    return newlyCompleted;
  }

  public recordInteraction(interactableId: string): Mission[] {
    const newlyCompleted: Mission[] = [];
    if (interactableId === 'captive_villager') {
      this.advanceObjective('rescue_villager', 'free_captive', 1, newlyCompleted);
    } else if (interactableId === 'relic_lost_katana') {
      this.advanceObjective('find_lost_katana', 'claim_katana_relic', 1, newlyCompleted);
    }
    return newlyCompleted;
  }

  private advanceObjective(
    missionId: string,
    objectiveId: string,
    amount: number,
    newlyCompleted: Mission[]
  ): void {
    const mission = this.missions.find((m) => m.id === missionId);
    if (!mission || mission.status === 'completed') return;
    if (mission.status === 'available') mission.status = 'active';

    const obj = mission.objectives.find((o) => o.id === objectiveId);
    if (!obj || obj.completed) return;

    obj.current = Math.min(obj.target, obj.current + amount);
    if (obj.current >= obj.target) {
      obj.completed = true;
    }

    if (mission.objectives.every((o) => o.completed)) {
      mission.status = 'completed';
      newlyCompleted.push(mission);
      if (this.activeMissionId === mission.id) {
        this.selectNextMission();
      }
    }
  }
}
