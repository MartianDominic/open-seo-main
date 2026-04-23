/**
 * Schema for brand voice management.
 * Phase 37: Brand Voice Management
 *
 * Three modes:
 * - preservation: Protect brand text from SEO changes
 * - application: Write in client's learned voice
 * - best_practices: Use industry defaults
 */
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./client-schema";
import { VOICE_MODES, type VoiceMode } from "./brief-schema";

// Re-export for convenience
export { VOICE_MODES, type VoiceMode };

// Brand archetype options
export const ARCHETYPES = [
  "professional",
  "casual",
  "technical",
  "friendly",
  "authoritative",
] as const;
export type Archetype = (typeof ARCHETYPES)[number];

// Contraction usage frequency
export const CONTRACTION_USAGE = [
  "never",
  "sometimes",
  "frequently",
] as const;
export type ContractionUsage = (typeof CONTRACTION_USAGE)[number];

// Heading capitalization style
export const HEADING_STYLES = [
  "title_case",
  "sentence_case",
  "all_caps",
] as const;
export type HeadingStyle = (typeof HEADING_STYLES)[number];

// Protection rule types
export const PROTECTION_RULE_TYPES = [
  "page",
  "section",
  "pattern",
] as const;
export type ProtectionRuleType = (typeof PROTECTION_RULE_TYPES)[number];

// JSONB type for vocabulary patterns
export interface VocabularyPatterns {
  preferred: string[];
  avoided: string[];
}

// JSONB type for raw AI analysis response
export interface RawVoiceAnalysis {
  model: string;
  prompt: string;
  response: string;
  tokens_used: number;
  analyzed_at: string;
}

/**
 * Voice profiles table - stores the 12 voice dimensions per client.
 * One profile per client (can be extended for multi-brand clients later).
 */
export const voiceProfiles = pgTable(
  "voice_profiles",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Mode selection
    mode: text("mode").notNull().default("best_practices"),

    // Voice Dimension 1-2: Tone
    tonePrimary: text("tone_primary"),
    toneSecondary: text("tone_secondary"),

    // Voice Dimension 3: Formality (1-10 scale)
    formalityLevel: integer("formality_level"),

    // Voice Dimension 4: Personality traits
    personalityTraits: jsonb("personality_traits").$type<string[]>(),

    // Voice Dimension 5: Archetype
    archetype: text("archetype"),

    // Voice Dimension 6-7: Sentence and paragraph length
    sentenceLengthAvg: integer("sentence_length_avg"),
    paragraphLengthAvg: integer("paragraph_length_avg"),

    // Voice Dimension 8: Contraction usage
    contractionUsage: text("contraction_usage"),

    // Voice Dimension 9: Vocabulary patterns
    vocabularyPatterns: jsonb("vocabulary_patterns").$type<VocabularyPatterns>(),

    // Voice Dimension 10-11: Signature and forbidden phrases
    signaturePhrases: jsonb("signature_phrases").$type<string[]>(),
    forbiddenPhrases: jsonb("forbidden_phrases").$type<string[]>(),

    // Voice Dimension 12: Heading style
    headingStyle: text("heading_style"),

    // Confidence score from AI analysis (0-100)
    confidenceScore: integer("confidence_score"),

    // Timestamps
    analyzedAt: timestamp("analyzed_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_voice_profiles_client").on(table.clientId),
  ],
);

/**
 * Voice analysis table - stores per-page analysis results.
 * Multiple analyses per profile (one per scraped page).
 */
export const voiceAnalysis = pgTable(
  "voice_analysis",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),

    // Page analyzed
    url: text("url").notNull(),

    // Full AI response for debugging/audit
    rawAnalysis: jsonb("raw_analysis").$type<RawVoiceAnalysis>(),

    // Extracted voice attributes from this page
    extractedTone: text("extracted_tone"),
    extractedFormality: integer("extracted_formality"),
    sampleSentences: jsonb("sample_sentences").$type<string[]>(),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_voice_analysis_profile").on(table.profileId),
    index("ix_voice_analysis_url").on(table.url),
  ],
);

/**
 * Content protection rules - pages/sections/patterns to preserve.
 * Used in preservation mode to exclude content from SEO changes.
 */
export const contentProtectionRules = pgTable(
  "content_protection_rules",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => voiceProfiles.id, { onDelete: "cascade" }),

    // Rule type determines how target is interpreted
    ruleType: text("rule_type").notNull(),

    // Target: URL path (page), CSS selector (section), or regex (pattern)
    target: text("target").notNull(),

    // Optional expiration for temporary rules
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),

    // Documentation
    reason: text("reason"),
    createdBy: text("created_by").notNull(),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_protection_rules_profile").on(table.profileId),
    index("ix_protection_rules_type").on(table.ruleType),
  ],
);

// Relations
export const voiceProfilesRelations = relations(voiceProfiles, ({ one, many }) => ({
  client: one(clients, {
    fields: [voiceProfiles.clientId],
    references: [clients.id],
  }),
  analyses: many(voiceAnalysis),
  protectionRules: many(contentProtectionRules),
}));

export const voiceAnalysisRelations = relations(voiceAnalysis, ({ one }) => ({
  profile: one(voiceProfiles, {
    fields: [voiceAnalysis.profileId],
    references: [voiceProfiles.id],
  }),
}));

export const contentProtectionRulesRelations = relations(contentProtectionRules, ({ one }) => ({
  profile: one(voiceProfiles, {
    fields: [contentProtectionRules.profileId],
    references: [voiceProfiles.id],
  }),
}));

// Type exports
export type VoiceProfileSelect = typeof voiceProfiles.$inferSelect;
export type VoiceProfileInsert = typeof voiceProfiles.$inferInsert;
export type VoiceAnalysisSelect = typeof voiceAnalysis.$inferSelect;
export type VoiceAnalysisInsert = typeof voiceAnalysis.$inferInsert;
export type ContentProtectionRuleSelect = typeof contentProtectionRules.$inferSelect;
export type ContentProtectionRuleInsert = typeof contentProtectionRules.$inferInsert;
