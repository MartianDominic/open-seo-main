import { describe, it, expect } from "vitest";
import {
  voiceProfiles,
  voiceAnalysis,
  contentProtectionRules,
  VOICE_MODES,
  ARCHETYPES,
  CONTRACTION_USAGE,
  HEADING_STYLES,
  PROTECTION_RULE_TYPES,
  type VoiceMode,
  type Archetype,
  type ContractionUsage,
  type HeadingStyle,
  type ProtectionRuleType,
  type VocabularyPatterns,
  type VoiceProfileSelect,
  type VoiceProfileInsert,
  type VoiceAnalysisSelect,
  type VoiceAnalysisInsert,
  type ContentProtectionRuleSelect,
  type ContentProtectionRuleInsert,
} from "./voice-schema";

describe("VoiceSchema Types", () => {
  describe("VOICE_MODES", () => {
    it("should contain all required voice mode values", () => {
      expect(VOICE_MODES).toContain("preservation");
      expect(VOICE_MODES).toContain("application");
      expect(VOICE_MODES).toContain("best_practices");
      expect(VOICE_MODES).toHaveLength(3);
    });

    it("should accept valid voice mode values", () => {
      const mode: VoiceMode = "preservation";
      expect(VOICE_MODES.includes(mode)).toBe(true);
    });
  });

  describe("ARCHETYPES", () => {
    it("should contain all required archetype values", () => {
      expect(ARCHETYPES).toContain("professional");
      expect(ARCHETYPES).toContain("casual");
      expect(ARCHETYPES).toContain("technical");
      expect(ARCHETYPES).toContain("friendly");
      expect(ARCHETYPES).toContain("authoritative");
      expect(ARCHETYPES).toHaveLength(5);
    });

    it("should accept valid archetype values", () => {
      const archetype: Archetype = "professional";
      expect(ARCHETYPES.includes(archetype)).toBe(true);
    });
  });

  describe("CONTRACTION_USAGE", () => {
    it("should contain all required contraction usage values", () => {
      expect(CONTRACTION_USAGE).toContain("never");
      expect(CONTRACTION_USAGE).toContain("sometimes");
      expect(CONTRACTION_USAGE).toContain("frequently");
      expect(CONTRACTION_USAGE).toHaveLength(3);
    });

    it("should accept valid contraction usage values", () => {
      const usage: ContractionUsage = "sometimes";
      expect(CONTRACTION_USAGE.includes(usage)).toBe(true);
    });
  });

  describe("HEADING_STYLES", () => {
    it("should contain all required heading style values", () => {
      expect(HEADING_STYLES).toContain("title_case");
      expect(HEADING_STYLES).toContain("sentence_case");
      expect(HEADING_STYLES).toContain("all_caps");
      expect(HEADING_STYLES).toHaveLength(3);
    });

    it("should accept valid heading style values", () => {
      const style: HeadingStyle = "title_case";
      expect(HEADING_STYLES.includes(style)).toBe(true);
    });
  });

  describe("PROTECTION_RULE_TYPES", () => {
    it("should contain all required rule type values", () => {
      expect(PROTECTION_RULE_TYPES).toContain("page");
      expect(PROTECTION_RULE_TYPES).toContain("section");
      expect(PROTECTION_RULE_TYPES).toContain("pattern");
      expect(PROTECTION_RULE_TYPES).toHaveLength(3);
    });

    it("should accept valid rule type values", () => {
      const ruleType: ProtectionRuleType = "page";
      expect(PROTECTION_RULE_TYPES.includes(ruleType)).toBe(true);
    });
  });

  describe("voiceProfiles table", () => {
    it("should have required column structure", () => {
      const columns = Object.keys(voiceProfiles);
      expect(columns).toContain("id");
      expect(columns).toContain("clientId");
      expect(columns).toContain("mode");
      expect(columns).toContain("tonePrimary");
      expect(columns).toContain("toneSecondary");
      expect(columns).toContain("formalityLevel");
      expect(columns).toContain("personalityTraits");
      expect(columns).toContain("archetype");
      expect(columns).toContain("sentenceLengthAvg");
      expect(columns).toContain("paragraphLengthAvg");
      expect(columns).toContain("contractionUsage");
      expect(columns).toContain("vocabularyPatterns");
      expect(columns).toContain("signaturePhrases");
      expect(columns).toContain("forbiddenPhrases");
      expect(columns).toContain("headingStyle");
      expect(columns).toContain("confidenceScore");
      expect(columns).toContain("analyzedAt");
      expect(columns).toContain("createdAt");
      expect(columns).toContain("updatedAt");
    });

    it("should have 12 voice dimension columns", () => {
      const voiceDimensions = [
        "tonePrimary",
        "toneSecondary",
        "formalityLevel",
        "personalityTraits",
        "archetype",
        "sentenceLengthAvg",
        "paragraphLengthAvg",
        "contractionUsage",
        "vocabularyPatterns",
        "signaturePhrases",
        "forbiddenPhrases",
        "headingStyle",
      ];
      voiceDimensions.forEach((dim) => {
        expect(Object.keys(voiceProfiles)).toContain(dim);
      });
    });
  });

  describe("voiceAnalysis table", () => {
    it("should have required column structure", () => {
      const columns = Object.keys(voiceAnalysis);
      expect(columns).toContain("id");
      expect(columns).toContain("profileId");
      expect(columns).toContain("url");
      expect(columns).toContain("rawAnalysis");
      expect(columns).toContain("extractedTone");
      expect(columns).toContain("extractedFormality");
      expect(columns).toContain("sampleSentences");
      expect(columns).toContain("createdAt");
    });
  });

  describe("contentProtectionRules table", () => {
    it("should have required column structure", () => {
      const columns = Object.keys(contentProtectionRules);
      expect(columns).toContain("id");
      expect(columns).toContain("profileId");
      expect(columns).toContain("ruleType");
      expect(columns).toContain("target");
      expect(columns).toContain("expiresAt");
      expect(columns).toContain("reason");
      expect(columns).toContain("createdBy");
      expect(columns).toContain("createdAt");
    });
  });

  describe("VocabularyPatterns interface", () => {
    it("should accept valid vocabulary patterns", () => {
      const patterns: VocabularyPatterns = {
        preferred: ["innovative", "trusted", "expert"],
        avoided: ["cheap", "basic", "simple"],
      };
      expect(patterns.preferred).toHaveLength(3);
      expect(patterns.avoided).toHaveLength(3);
    });

    it("should handle empty arrays", () => {
      const patterns: VocabularyPatterns = {
        preferred: [],
        avoided: [],
      };
      expect(patterns.preferred).toHaveLength(0);
      expect(patterns.avoided).toHaveLength(0);
    });
  });

  describe("VoiceProfileInsert type", () => {
    it("should require mandatory fields", () => {
      const profile: VoiceProfileInsert = {
        id: "vp_123",
        clientId: "client_456",
        mode: "application",
      };
      expect(profile.id).toBe("vp_123");
      expect(profile.clientId).toBe("client_456");
      expect(profile.mode).toBe("application");
    });

    it("should accept all optional voice dimensions", () => {
      const profile: VoiceProfileInsert = {
        id: "vp_123",
        clientId: "client_456",
        mode: "preservation",
        tonePrimary: "professional",
        toneSecondary: "empathetic",
        formalityLevel: 8,
        personalityTraits: ["trustworthy", "knowledgeable"],
        archetype: "authoritative",
        sentenceLengthAvg: 18,
        paragraphLengthAvg: 4,
        contractionUsage: "never",
        vocabularyPatterns: { preferred: ["expert"], avoided: ["cheap"] },
        signaturePhrases: ["industry-leading"],
        forbiddenPhrases: ["cutting-edge"],
        headingStyle: "title_case",
        confidenceScore: 85,
      };
      expect(profile.tonePrimary).toBe("professional");
      expect(profile.formalityLevel).toBe(8);
    });
  });

  describe("VoiceAnalysisInsert type", () => {
    it("should require mandatory fields", () => {
      const analysis: VoiceAnalysisInsert = {
        id: "va_123",
        profileId: "vp_456",
        url: "https://example.com/about",
      };
      expect(analysis.id).toBe("va_123");
      expect(analysis.profileId).toBe("vp_456");
      expect(analysis.url).toBe("https://example.com/about");
    });
  });

  describe("ContentProtectionRuleInsert type", () => {
    it("should require mandatory fields", () => {
      const rule: ContentProtectionRuleInsert = {
        id: "cpr_123",
        profileId: "vp_456",
        ruleType: "page",
        target: "/about",
        createdBy: "user_789",
      };
      expect(rule.id).toBe("cpr_123");
      expect(rule.ruleType).toBe("page");
      expect(rule.target).toBe("/about");
    });

    it("should accept optional expires_at field", () => {
      const rule: ContentProtectionRuleInsert = {
        id: "cpr_123",
        profileId: "vp_456",
        ruleType: "section",
        target: ".hero-section",
        createdBy: "user_789",
        expiresAt: new Date("2026-12-31"),
        reason: "Brand messaging locked until rebrand",
      };
      expect(rule.expiresAt).toBeInstanceOf(Date);
      expect(rule.reason).toBe("Brand messaging locked until rebrand");
    });
  });
});
