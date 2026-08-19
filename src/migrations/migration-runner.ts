// Migration runner for handling IR schema versions
import { ProjectIR, createID } from '../shared/types';

// Migration functions for each version
type MigrationFunction = (project: any) => ProjectIR;

// Migration from version 0 to version 1 (initial version)
const migrateV0ToV1: MigrationFunction = (project: any) => {
  // If the project already has schemaVersion, it's already at v1 or higher
  if (project.meta && project.meta.schemaVersion >= 1) {
    return project as ProjectIR;
  }

  // Otherwise, migrate from v0 (no schema version) to v1
  const migrated: ProjectIR = {
    ...project,
    meta: {
      ...project.meta,
      schemaVersion: 1,
      // Ensure we have an ID if missing
      id: project.meta.id || `migrated-${Date.now()}`,
      // Ensure timestamps exist
      createdAt: project.meta.createdAt || new Date().toISOString(),
      modifiedAt: project.meta.modifiedAt || new Date().toISOString()
    }
  };

  // Ensure all required collections exist
  if (!migrated.characters) migrated.characters = {};
  if (!migrated.assets) migrated.assets = {};
  if (!migrated.variables) migrated.variables = {};
  if (!migrated.scenes) migrated.scenes = {};
  if (!migrated.conditions) migrated.conditions = {};
  if (!migrated.exportProfiles) migrated.exportProfiles = {};

  // Ensure flow exists
  if (!migrated.flow) {
    migrated.flow = {
      entrySceneId: createID(''),
      connections: []
    };
  }

  // Ensure UI exists
  if (!migrated.ui) {
    migrated.ui = {
      theme: 'auto',
      dialogueBoxStyle: 'classic',
      choicePresentation: 'vertical'
    };
  }

  // Ensure localization exists
  if (!migrated.localization) {
    migrated.localization = {
      defaultLocale: 'en',
      locales: {}
    };
  }

  // Ensure AI settings exist
  if (!migrated.ai) {
    migrated.ai = {
      enabled: false
    };
  }

  return migrated;
};

// Migration from version 1 to version 2 (adds the per-project AI assistant setting)
const migrateV1ToV2: MigrationFunction = (project: any) => {
  const migrated: ProjectIR = {
    ...project,
    meta: {
      ...project.meta,
      schemaVersion: 2
    }
  };

  if (!migrated.ai) {
    migrated.ai = {
      enabled: false
    };
  } else {
    migrated.ai = {
      enabled: migrated.ai.enabled === true
    };
  }

  return migrated;
};

// Migration from version 2 to version 3 (adds the plugin block type)
// v2 projects contain no plugin blocks, so this only bumps the schema version.
const migrateV2ToV3: MigrationFunction = (project: any) => {
  return {
    ...project,
    meta: {
      ...project.meta,
      schemaVersion: 3
    }
  };
};

// Map of migrations: from version -> to version
const migrations: Record<number, MigrationFunction> = {
  1: migrateV0ToV1,
  2: migrateV1ToV2,
  3: migrateV2ToV3
};

export class MigrationRunner {
  private static readonly CURRENT_SCHEMA_VERSION = 3;

  /**
   * Migrate a project to the current schema version
   * @param project The project to migrate (may be an older version)
   * @returns The migrated project at current schema version
   */
  public static migrate(project: any): ProjectIR {
    let currentProject = project;
    let currentVersion = currentProject.meta?.schemaVersion || 0;

    // Apply migrations in order until we reach current version
    for (let version = currentVersion + 1; version <= this.CURRENT_SCHEMA_VERSION; version++) {
      const migration = migrations[version];
      if (migration) {
        console.log(`Migrating project from schema version ${version - 1} to ${version}`);
        currentProject = migration(currentProject);
      } else {
        throw new Error(`No migration found for schema version ${version}`);
      }
    }

    // Ensure the final project has the correct schema version
    if (currentProject.meta) {
      currentProject.meta.schemaVersion = this.CURRENT_SCHEMA_VERSION;
    }

    return currentProject as ProjectIR;
  }

  /**
   * Get the current schema version
   */
  public static getCurrentSchemaVersion(): number {
    return this.CURRENT_SCHEMA_VERSION;
  }

  /**
   * Check if a project needs migration
   * @param project The project to check
   * @returns true if migration is needed
   */
  public static needsMigration(project: any): boolean {
    const projectVersion = project.meta?.schemaVersion || 0;
    return projectVersion < this.CURRENT_SCHEMA_VERSION;
  }
}

// Export a simple function for easy migration
export function migrateProject(project: any): ProjectIR {
  return MigrationRunner.migrate(project);
}