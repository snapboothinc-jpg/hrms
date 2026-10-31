export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      ai_generation_logs: {
        Row: {
          created_at: string;
          employee_id: string | null;
          error: string | null;
          id: string;
          latency_ms: number | null;
          model: string;
          status: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          employee_id?: string | null;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          model: string;
          status: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          employee_id?: string | null;
          error?: string | null;
          id?: string;
          latency_ms?: number | null;
          model?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ai_integration_settings: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          last_checked_at: string | null;
          last_error: string | null;
          last_status: string | null;
          model: string;
          provider: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          last_status?: string | null;
          model?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_checked_at?: string | null;
          last_error?: string | null;
          last_status?: string | null;
          model?: string;
          provider?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      ai_recommendation_reviews: {
        Row: {
          comments: string | null;
          created_at: string;
          created_by: string | null;
          decision: string;
          edited: Json | null;
          id: string;
          is_demo: boolean;
          recommendation_id: string;
          reviewer_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision: string;
          edited?: Json | null;
          id?: string;
          is_demo?: boolean;
          recommendation_id: string;
          reviewer_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision?: string;
          edited?: Json | null;
          id?: string;
          is_demo?: boolean;
          recommendation_id?: string;
          reviewer_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_recommendation_reviews_recommendation_id_fkey";
            columns: ["recommendation_id"];
            isOneToOne: false;
            referencedRelation: "ai_recommendations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_recommendations: {
        Row: {
          competency_id: string;
          created_at: string;
          created_by: string | null;
          current_level: number | null;
          employee_id: string;
          expected_outcome: string | null;
          gap: number;
          gap_snapshot_id: string | null;
          generated_by: string;
          id: string;
          is_demo: boolean;
          model: string;
          priority: string;
          rationale: string;
          recommendation_type: string;
          required_level: number;
          resource_id: string;
          sources: Json;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          employee_id: string;
          expected_outcome?: string | null;
          gap: number;
          gap_snapshot_id?: string | null;
          generated_by: string;
          id?: string;
          is_demo?: boolean;
          model: string;
          priority?: string;
          rationale: string;
          recommendation_type: string;
          required_level: number;
          resource_id: string;
          sources?: Json;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          employee_id?: string;
          expected_outcome?: string | null;
          gap?: number;
          gap_snapshot_id?: string | null;
          generated_by?: string;
          id?: string;
          is_demo?: boolean;
          model?: string;
          priority?: string;
          rationale?: string;
          recommendation_type?: string;
          required_level?: number;
          resource_id?: string;
          sources?: Json;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_recommendations_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      approval_tasks: {
        Row: {
          assignee_role: Database["public"]["Enums"]["app_role"] | null;
          assignee_user: string | null;
          comments: string | null;
          created_at: string;
          created_by: string | null;
          decided_at: string | null;
          decided_by: string | null;
          employee_id: string | null;
          id: string;
          record_id: string;
          record_label: string;
          status: string;
          submitted_by: string | null;
          updated_at: string;
          updated_by: string | null;
          workflow_type: string;
        };
        Insert: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null;
          assignee_user?: string | null;
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          employee_id?: string | null;
          id?: string;
          record_id: string;
          record_label: string;
          status?: string;
          submitted_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          workflow_type: string;
        };
        Update: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null;
          assignee_user?: string | null;
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          employee_id?: string | null;
          id?: string;
          record_id?: string;
          record_label?: string;
          status?: string;
          submitted_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          workflow_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "approval_tasks_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          id: string;
          record_id: string | null;
          table_name: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: string;
          record_id?: string | null;
          table_name?: string;
        };
        Relationships: [];
      };
      behavioral_indicators: {
        Row: {
          competency_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          indicator: string;
          level: number;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          indicator: string;
          level: number;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          indicator?: string;
          level?: number;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "behavioral_indicators_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
        ];
      };
      competencies: {
        Row: {
          category_id: string;
          code: string;
          created_at: string;
          created_by: string | null;
          definition: string | null;
          description: string | null;
          id: string;
          is_demo: boolean;
          is_mandatory: boolean;
          is_safety_critical: boolean;
          name: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          category_id: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          definition?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          is_mandatory?: boolean;
          is_safety_critical?: boolean;
          name: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          category_id?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          definition?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          is_mandatory?: boolean;
          is_safety_critical?: boolean;
          name?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competencies_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "competency_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      competency_assessment_evidence: {
        Row: {
          assessment_id: string;
          created_at: string;
          created_by: string | null;
          file_id: string | null;
          id: string;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assessment_id: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assessment_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competency_assessment_evidence_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "competency_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_assessment_evidence_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "file_metadata";
            referencedColumns: ["id"];
          },
        ];
      };
      competency_assessments: {
        Row: {
          assessment_date: string;
          assessor_id: string;
          comments: string | null;
          competency_id: string;
          created_at: string;
          created_by: string | null;
          current_level: number | null;
          cycle_id: string | null;
          employee_id: string;
          evidence_summary: string | null;
          id: string;
          is_demo: boolean;
          is_reassessment: boolean;
          review_comments: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          assessment_date?: string;
          assessor_id?: string;
          comments?: string | null;
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          cycle_id?: string | null;
          employee_id: string;
          evidence_summary?: string | null;
          id?: string;
          is_demo?: boolean;
          is_reassessment?: boolean;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          assessment_date?: string;
          assessor_id?: string;
          comments?: string | null;
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          cycle_id?: string | null;
          employee_id?: string;
          evidence_summary?: string | null;
          id?: string;
          is_demo?: boolean;
          is_reassessment?: boolean;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competency_assessments_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_assessments_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_assessments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      competency_categories: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      competency_gap_snapshots: {
        Row: {
          assessment_id: string | null;
          competency_id: string;
          created_at: string;
          created_by: string | null;
          current_level: number | null;
          employee_id: string;
          gap: number | null;
          gap_status: string;
          id: string;
          is_mandatory: boolean;
          is_safety_critical: boolean;
          position_id: string;
          required_level: number;
          snapshot_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assessment_id?: string | null;
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          employee_id: string;
          gap?: number | null;
          gap_status: string;
          id?: string;
          is_mandatory: boolean;
          is_safety_critical: boolean;
          position_id: string;
          required_level: number;
          snapshot_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assessment_id?: string | null;
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          current_level?: number | null;
          employee_id?: string;
          gap?: number | null;
          gap_status?: string;
          id?: string;
          is_mandatory?: boolean;
          is_safety_critical?: boolean;
          position_id?: string;
          required_level?: number;
          snapshot_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competency_gap_snapshots_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "competency_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_gap_snapshots_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_gap_snapshots_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_gap_snapshots_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      competency_reassessments: {
        Row: {
          assessment_id: string;
          competency_id: string;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          id: string;
          is_demo: boolean;
          notes: string | null;
          session_id: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assessment_id: string;
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          session_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assessment_id?: string;
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          session_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "competency_reassessments_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "competency_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_reassessments_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_reassessments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competency_reassessments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      course_competency_mappings: {
        Row: {
          competency_id: string;
          course_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          target_level: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          competency_id: string;
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          target_level: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          competency_id?: string;
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          target_level?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_competency_mappings_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_competency_mappings_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      course_completions: {
        Row: {
          completed_at: string;
          course_id: string;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          enrollment_id: string;
          id: string;
          is_demo: boolean;
          score: number | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          completed_at?: string;
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          enrollment_id: string;
          id?: string;
          is_demo?: boolean;
          score?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          completed_at?: string;
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          enrollment_id?: string;
          id?: string;
          is_demo?: boolean;
          score?: number | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_completions_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_completions_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_completions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "course_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      course_enrollments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          completed_at: string | null;
          course_id: string;
          created_at: string;
          created_by: string | null;
          development_plan_item_id: string | null;
          due_date: string | null;
          employee_id: string;
          id: string;
          is_demo: boolean;
          source: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          completed_at?: string | null;
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          development_plan_item_id?: string | null;
          due_date?: string | null;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          source?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          completed_at?: string | null;
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          development_plan_item_id?: string | null;
          due_date?: string | null;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          source?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "course_enrollments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      course_sections: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          category: string | null;
          code: string;
          completion_rule: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          difficulty: string;
          duration_minutes: number | null;
          enrollment_open: boolean;
          id: string;
          is_demo: boolean;
          objectives: string | null;
          owner_id: string | null;
          review_comments: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          category?: string | null;
          code: string;
          completion_rule?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          difficulty?: string;
          duration_minutes?: number | null;
          enrollment_open?: boolean;
          id?: string;
          is_demo?: boolean;
          objectives?: string | null;
          owner_id?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          category?: string | null;
          code?: string;
          completion_rule?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          difficulty?: string;
          duration_minutes?: number | null;
          enrollment_open?: boolean;
          id?: string;
          is_demo?: boolean;
          objectives?: string | null;
          owner_id?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "courses_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      critical_positions: {
        Row: {
          business_impact: string | null;
          created_at: string;
          created_by: string | null;
          criticality: string;
          department_id: string;
          id: string;
          incumbent_employee_id: string | null;
          is_demo: boolean;
          position_id: string;
          review_date: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          business_impact?: string | null;
          created_at?: string;
          created_by?: string | null;
          criticality?: string;
          department_id: string;
          id?: string;
          incumbent_employee_id?: string | null;
          is_demo?: boolean;
          position_id: string;
          review_date?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          business_impact?: string | null;
          created_at?: string;
          created_by?: string | null;
          criticality?: string;
          department_id?: string;
          id?: string;
          incumbent_employee_id?: string | null;
          is_demo?: boolean;
          position_id?: string;
          review_date?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "critical_positions_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "critical_positions_incumbent_employee_id_fkey";
            columns: ["incumbent_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "critical_positions_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          head_employee_id: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          parent_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          head_employee_id?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          parent_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          head_employee_id?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          parent_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "departments_head_fk";
            columns: ["head_employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "departments_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      development_plan_items: {
        Row: {
          ai_recommendation_id: string | null;
          competency_id: string | null;
          completed_at: string | null;
          course_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          evidence: string | null;
          gap_snapshot_id: string | null;
          id: string;
          is_demo: boolean;
          item_type: string;
          learning_path_id: string | null;
          plan_id: string;
          priority: string;
          status: string;
          target_date: string | null;
          title: string;
          training_session_id: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          ai_recommendation_id?: string | null;
          competency_id?: string | null;
          completed_at?: string | null;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          evidence?: string | null;
          gap_snapshot_id?: string | null;
          id?: string;
          is_demo?: boolean;
          item_type: string;
          learning_path_id?: string | null;
          plan_id: string;
          priority?: string;
          status?: string;
          target_date?: string | null;
          title: string;
          training_session_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          ai_recommendation_id?: string | null;
          competency_id?: string | null;
          completed_at?: string | null;
          course_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          evidence?: string | null;
          gap_snapshot_id?: string | null;
          id?: string;
          is_demo?: boolean;
          item_type?: string;
          learning_path_id?: string | null;
          plan_id?: string;
          priority?: string;
          status?: string;
          target_date?: string | null;
          title?: string;
          training_session_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "development_plan_items_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plan_items_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plan_items_learning_path_id_fkey";
            columns: ["learning_path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plan_items_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "development_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      development_plans: {
        Row: {
          approval_status: string;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          id: string;
          is_demo: boolean;
          notes: string | null;
          objectives: string | null;
          reassessment_due_date: string | null;
          review_comments: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          responsible_id: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          target_date: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          approval_status?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          objectives?: string | null;
          reassessment_due_date?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          responsible_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          approval_status?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          objectives?: string | null;
          reassessment_due_date?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          responsible_id?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "development_plans_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plans_responsible_id_fkey";
            columns: ["responsible_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plans_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_plans_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      personal_goals: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          employee_id: string;
          evaluation_assignment_id: string | null;
          id: string;
          is_demo: boolean;
          progress: number;
          progress_comment: string | null;
          review_comment: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          status: string;
          success_criteria: string | null;
          target_date: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          employee_id: string;
          evaluation_assignment_id?: string | null;
          id?: string;
          is_demo?: boolean;
          progress?: number;
          progress_comment?: string | null;
          review_comment?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          success_criteria?: string | null;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          employee_id?: string;
          evaluation_assignment_id?: string | null;
          id?: string;
          is_demo?: boolean;
          progress?: number;
          progress_comment?: string | null;
          review_comment?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          status?: string;
          success_criteria?: string | null;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "personal_goals_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_goals_evaluation_assignment_id_fkey";
            columns: ["evaluation_assignment_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "personal_goals_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      employees: {
        Row: {
          created_at: string;
          created_by: string | null;
          department_id: string;
          email: string | null;
          employee_code: string;
          employment_status: string;
          first_name: string;
          hire_date: string | null;
          id: string;
          is_demo: boolean;
          job_notes: string | null;
          last_name: string;
          phone: string | null;
          position_id: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          department_id: string;
          email?: string | null;
          employee_code: string;
          employment_status?: string;
          first_name: string;
          hire_date?: string | null;
          id?: string;
          is_demo?: boolean;
          job_notes?: string | null;
          last_name: string;
          phone?: string | null;
          position_id: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          department_id?: string;
          email?: string | null;
          employee_code?: string;
          employment_status?: string;
          first_name?: string;
          hire_date?: string | null;
          id?: string;
          is_demo?: boolean;
          job_notes?: string | null;
          last_name?: string;
          phone?: string | null;
          position_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_assignments: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          acknowledgement_comment: string | null;
          created_at: string;
          created_by: string | null;
          cycle_id: string;
          employee_id: string;
          evaluator_id: string;
          id: string;
          is_demo: boolean;
          overall_comment: string | null;
          overall_score: number | null;
          profile_version_id: string;
          reopen_reason: string | null;
          self_evaluation: boolean;
          self_submitted_at: string | null;
          snapshot: Json;
          status: string;
          submitted_at: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          acknowledgement_comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          cycle_id: string;
          employee_id: string;
          evaluator_id: string;
          id?: string;
          is_demo?: boolean;
          overall_comment?: string | null;
          overall_score?: number | null;
          profile_version_id: string;
          reopen_reason?: string | null;
          self_evaluation?: boolean;
          self_submitted_at?: string | null;
          snapshot: Json;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          acknowledgement_comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          cycle_id?: string;
          employee_id?: string;
          evaluator_id?: string;
          id?: string;
          is_demo?: boolean;
          overall_comment?: string | null;
          overall_score?: number | null;
          profile_version_id?: string;
          reopen_reason?: string | null;
          self_evaluation?: boolean;
          self_submitted_at?: string | null;
          snapshot?: Json;
          status?: string;
          submitted_at?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_assignments_cycle_id_fkey";
            columns: ["cycle_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_cycles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_assignments_evaluator_id_fkey";
            columns: ["evaluator_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_assignments_profile_version_id_fkey";
            columns: ["profile_version_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_profile_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_cycles: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          due_date: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          period_end: string;
          period_start: string;
          self_evaluation: boolean;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          period_end: string;
          period_start: string;
          self_evaluation?: boolean;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          period_end?: string;
          period_start?: string;
          self_evaluation?: boolean;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      evaluation_evidence: {
        Row: {
          assignment_id: string;
          created_at: string;
          created_by: string | null;
          file_id: string | null;
          id: string;
          item_id: string | null;
          note: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignment_id: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          item_id?: string | null;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignment_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          item_id?: string | null;
          note?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_evidence_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_evidence_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "file_metadata";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_items: {
        Row: {
          competency_id: string | null;
          created_at: string;
          created_by: string | null;
          evidence_required: boolean;
          help_text: string | null;
          id: string;
          is_required: boolean;
          item_type: string;
          kpi_target: number | null;
          kpi_unit: string | null;
          label: string;
          options: Json;
          section_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
          version_id: string;
          weight: number;
        };
        Insert: {
          competency_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          evidence_required?: boolean;
          help_text?: string | null;
          id?: string;
          is_required?: boolean;
          item_type: string;
          kpi_target?: number | null;
          kpi_unit?: string | null;
          label: string;
          options?: Json;
          section_id: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
          version_id: string;
          weight?: number;
        };
        Update: {
          competency_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          evidence_required?: boolean;
          help_text?: string | null;
          id?: string;
          is_required?: boolean;
          item_type?: string;
          kpi_target?: number | null;
          kpi_unit?: string | null;
          label?: string;
          options?: Json;
          section_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
          version_id?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_items_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_items_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_sections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_items_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_profile_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_profile_versions: {
        Row: {
          activated_at: string | null;
          activated_by: string | null;
          created_at: string;
          created_by: string | null;
          effective_date: string | null;
          id: string;
          instructions: string | null;
          is_demo: boolean;
          position_id: string;
          profile_id: string;
          rating_scale_max: number;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
          version_number: number;
        };
        Insert: {
          activated_at?: string | null;
          activated_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          instructions?: string | null;
          is_demo?: boolean;
          position_id: string;
          profile_id: string;
          rating_scale_max?: number;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          version_number: number;
        };
        Update: {
          activated_at?: string | null;
          activated_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string | null;
          id?: string;
          instructions?: string | null;
          is_demo?: boolean;
          position_id?: string;
          profile_id?: string;
          rating_scale_max?: number;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_profile_versions_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evaluation_profile_versions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_demo: boolean;
          name: string;
          position_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          name: string;
          position_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          name?: string;
          position_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_profiles_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_responses: {
        Row: {
          assignment_id: string;
          choice_values: Json | null;
          comment: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          item_id: string;
          kpi_actual: number | null;
          rating: number | null;
          respondent: string;
          text_value: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignment_id: string;
          choice_values?: Json | null;
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id: string;
          kpi_actual?: number | null;
          rating?: number | null;
          respondent: string;
          text_value?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignment_id?: string;
          choice_values?: Json | null;
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          item_id?: string;
          kpi_actual?: number | null;
          rating?: number | null;
          respondent?: string;
          text_value?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_responses_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_reviews: {
        Row: {
          assignment_id: string;
          comments: string | null;
          created_at: string;
          created_by: string | null;
          decision: string;
          id: string;
          reviewer_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assignment_id: string;
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision: string;
          id?: string;
          reviewer_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assignment_id?: string;
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision?: string;
          id?: string;
          reviewer_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_reviews_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      evaluation_sections: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evaluation_sections_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "evaluation_profile_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      file_metadata: {
        Row: {
          bucket: string;
          created_at: string;
          created_by: string | null;
          employee_id: string | null;
          id: string;
          mime_type: string;
          object_path: string;
          original_name: string;
          size_bytes: number;
          updated_at: string;
          updated_by: string | null;
          uploaded_by: string;
        };
        Insert: {
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string | null;
          id?: string;
          mime_type: string;
          object_path: string;
          original_name: string;
          size_bytes: number;
          updated_at?: string;
          updated_by?: string | null;
          uploaded_by?: string;
        };
        Update: {
          bucket?: string;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string | null;
          id?: string;
          mime_type?: string;
          object_path?: string;
          original_name?: string;
          size_bytes?: number;
          updated_at?: string;
          updated_by?: string | null;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_metadata_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      idempotency_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          key: string;
          operation: string;
          request_hash: string;
          response: Json;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key: string;
          operation: string;
          request_hash: string;
          response: Json;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key?: string;
          operation?: string;
          request_hash?: string;
          response?: Json;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      learning_materials: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          file_id: string | null;
          id: string;
          label: string;
          lesson_id: string | null;
          updated_at: string;
          updated_by: string | null;
          url: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          label: string;
          lesson_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          url?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          file_id?: string | null;
          id?: string;
          label?: string;
          lesson_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learning_materials_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_materials_file_id_fkey";
            columns: ["file_id"];
            isOneToOne: false;
            referencedRelation: "file_metadata";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_materials_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_path_courses: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          path_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          path_id: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          path_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learning_path_courses_path_id_fkey";
            columns: ["path_id"];
            isOneToOne: false;
            referencedRelation: "learning_paths";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_paths: {
        Row: {
          competency_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_demo: boolean;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          competency_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          competency_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "learning_paths_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_progress: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          enrollment_id: string;
          id: string;
          lesson_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          enrollment_id: string;
          id?: string;
          lesson_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          enrollment_id?: string;
          id?: string;
          lesson_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_progress_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "course_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey";
            columns: ["lesson_id"];
            isOneToOne: false;
            referencedRelation: "lessons";
            referencedColumns: ["id"];
          },
        ];
      };
      lessons: {
        Row: {
          content: string | null;
          created_at: string;
          created_by: string | null;
          duration_minutes: number | null;
          id: string;
          section_id: string;
          sort_order: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          section_id: string;
          sort_order?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number | null;
          id?: string;
          section_id?: string;
          sort_order?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lessons_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "course_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          link: string | null;
          read_at: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          link?: string | null;
          read_at?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      outbox_events: {
        Row: {
          attempts: number;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: string;
          last_error: string | null;
          next_retry_at: string;
          payload: Json;
          processed_at: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: string;
          last_error?: string | null;
          next_retry_at?: string;
          payload: Json;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: string;
          last_error?: string | null;
          next_retry_at?: string;
          payload?: Json;
          processed_at?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      position_competency_requirements: {
        Row: {
          change_reason: string | null;
          competency_id: string;
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          id: string;
          is_current: boolean;
          is_demo: boolean;
          is_mandatory: boolean;
          is_safety_critical: boolean;
          position_id: string;
          required_level: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          change_reason?: string | null;
          competency_id: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          is_current?: boolean;
          is_demo?: boolean;
          is_mandatory?: boolean;
          is_safety_critical?: boolean;
          position_id: string;
          required_level: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          change_reason?: string | null;
          competency_id?: string;
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          id?: string;
          is_current?: boolean;
          is_demo?: boolean;
          is_mandatory?: boolean;
          is_safety_critical?: boolean;
          position_id?: string;
          required_level?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "position_competency_requirements_competency_id_fkey";
            columns: ["competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "position_competency_requirements_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "positions";
            referencedColumns: ["id"];
          },
        ];
      };
      positions: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          department_id: string;
          description: string | null;
          id: string;
          is_demo: boolean;
          status: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          department_id: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          department_id?: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      proficiency_levels: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          label: string;
          level: number;
          requires_validation: boolean;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description: string;
          id?: string;
          label: string;
          level: number;
          requires_validation?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          label?: string;
          level?: number;
          requires_validation?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string;
          full_name: string | null;
          id: string;
          is_active: boolean;
          is_demo: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email: string;
          full_name?: string | null;
          id: string;
          is_active?: boolean;
          is_demo?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string;
          full_name?: string | null;
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      quiz_attempts: {
        Row: {
          answers: Json;
          attempt_no: number;
          created_at: string;
          created_by: string | null;
          employee_id: string;
          enrollment_id: string;
          id: string;
          is_demo: boolean;
          passed: boolean;
          quiz_id: string;
          score: number;
          started_at: string;
          submitted_at: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          answers: Json;
          attempt_no: number;
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          enrollment_id: string;
          id?: string;
          is_demo?: boolean;
          passed: boolean;
          quiz_id: string;
          score: number;
          started_at?: string;
          submitted_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          answers?: Json;
          attempt_no?: number;
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          enrollment_id?: string;
          id?: string;
          is_demo?: boolean;
          passed?: boolean;
          quiz_id?: string;
          score?: number;
          started_at?: string;
          submitted_at?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "course_enrollments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      quiz_questions: {
        Row: {
          correct_index: number;
          created_at: string;
          created_by: string | null;
          id: string;
          options: Json;
          question: string;
          quiz_id: string;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          correct_index: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          options: Json;
          question: string;
          quiz_id: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          correct_index?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          options?: Json;
          question?: string;
          quiz_id?: string;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
        ];
      };
      quizzes: {
        Row: {
          course_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          max_attempts: number;
          pass_score: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          max_attempts?: number;
          pass_score?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          max_attempts?: number;
          pass_score?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
        ];
      };
      readiness_classes: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          label: string;
          requires_validation: boolean;
          sort_order: number;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          requires_validation?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          requires_validation?: boolean;
          sort_order?: number;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      recognition_categories: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [];
      };
      recognition_nominations: {
        Row: {
          category_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          message: string;
          nominator_id: string;
          recipient_id: string;
          review_comments: string | null;
          reviewed_at: string | null;
          reviewer_id: string | null;
          show_nominator: boolean;
          status: string;
          supporting_info: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
          visibility: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          message: string;
          nominator_id: string;
          recipient_id: string;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          show_nominator?: boolean;
          status?: string;
          supporting_info?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          visibility?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          message?: string;
          nominator_id?: string;
          recipient_id?: string;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          show_nominator?: boolean;
          status?: string;
          supporting_info?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recognition_nominations_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "recognition_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recognition_nominations_nominator_id_fkey";
            columns: ["nominator_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recognition_nominations_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      recognition_publications: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          nomination_id: string;
          published_at: string;
          published_by: string | null;
          updated_at: string;
          updated_by: string | null;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          nomination_id: string;
          published_at?: string;
          published_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          visibility: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          nomination_id?: string;
          published_at?: string;
          published_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recognition_publications_nomination_id_fkey";
            columns: ["nomination_id"];
            isOneToOne: true;
            referencedRelation: "recognition_nominations";
            referencedColumns: ["id"];
          },
        ];
      };
      recognition_reviews: {
        Row: {
          comments: string | null;
          created_at: string;
          created_by: string | null;
          decision: string;
          id: string;
          is_demo: boolean;
          nomination_id: string;
          reviewer_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision: string;
          id?: string;
          is_demo?: boolean;
          nomination_id: string;
          reviewer_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          comments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decision?: string;
          id?: string;
          is_demo?: boolean;
          nomination_id?: string;
          reviewer_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "recognition_reviews_nomination_id_fkey";
            columns: ["nomination_id"];
            isOneToOne: false;
            referencedRelation: "recognition_nominations";
            referencedColumns: ["id"];
          },
        ];
      };
      reporting_relationships: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string;
          effective_to: string | null;
          employee_id: string;
          id: string;
          is_current: boolean;
          is_demo: boolean;
          supervisor_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          employee_id: string;
          id?: string;
          is_current?: boolean;
          is_demo?: boolean;
          supervisor_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string;
          effective_to?: string | null;
          employee_id?: string;
          id?: string;
          is_current?: boolean;
          is_demo?: boolean;
          supervisor_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reporting_relationships_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reporting_relationships_supervisor_id_fkey";
            columns: ["supervisor_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          permission: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          permission: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          permission?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      report_export_history: {
        Row: {
          created_by: string | null;
          download_available: boolean;
          format: string;
          id: string;
          is_demo: boolean;
          report_kind: string;
          report_name: string;
          requested_at: string;
          result: string;
          row_count: number;
          scope: Json;
          user_id: string;
        };
        Insert: {
          created_by?: string | null;
          download_available?: boolean;
          format: string;
          id?: string;
          is_demo?: boolean;
          report_kind: string;
          report_name: string;
          requested_at?: string;
          result: string;
          row_count: number;
          scope?: Json;
          user_id: string;
        };
        Update: {
          created_by?: string | null;
          download_available?: boolean;
          format?: string;
          id?: string;
          is_demo?: boolean;
          report_kind?: string;
          report_name?: string;
          requested_at?: string;
          result?: string;
          row_count?: number;
          scope?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "report_export_history_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_report_definitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          filters: Json;
          id: string;
          name: string;
          report_kind: string;
          selected_columns: string[];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          filters?: Json;
          id?: string;
          name: string;
          report_kind: string;
          selected_columns?: string[];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          filters?: Json;
          id?: string;
          name?: string;
          report_kind?: string;
          selected_columns?: string[];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "saved_report_definitions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      status_transitions: {
        Row: {
          created_at: string;
          created_by: string | null;
          entity: string;
          from_status: string;
          id: string;
          to_status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          entity: string;
          from_status: string;
          id?: string;
          to_status: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          entity?: string;
          from_status?: string;
          id?: string;
          to_status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      succession_access_grants: {
        Row: {
          created_at: string;
          created_by: string | null;
          department_id: string;
          granted_by: string | null;
          id: string;
          is_demo: boolean;
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          department_id: string;
          granted_by?: string | null;
          id?: string;
          is_demo?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          department_id?: string;
          granted_by?: string | null;
          id?: string;
          is_demo?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "succession_access_grants_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_access_grants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      succession_candidates: {
        Row: {
          created_at: string;
          created_by: string | null;
          critical_position_id: string;
          employee_id: string;
          id: string;
          is_demo: boolean;
          notes: string | null;
          readiness_class_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          critical_position_id: string;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          readiness_class_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          critical_position_id?: string;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          notes?: string | null;
          readiness_class_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "succession_candidates_critical_position_id_fkey";
            columns: ["critical_position_id"];
            isOneToOne: false;
            referencedRelation: "critical_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_candidates_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_candidates_readiness_class_id_fkey";
            columns: ["readiness_class_id"];
            isOneToOne: false;
            referencedRelation: "readiness_classes";
            referencedColumns: ["id"];
          },
        ];
      };
      succession_plans: {
        Row: {
          created_at: string;
          created_by: string | null;
          critical_position_id: string;
          id: string;
          is_demo: boolean;
          owner_user_id: string | null;
          review_comments: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          submitted_at: string | null;
          submitted_by: string | null;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          critical_position_id: string;
          id?: string;
          is_demo?: boolean;
          owner_user_id?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          critical_position_id?: string;
          id?: string;
          is_demo?: boolean;
          owner_user_id?: string | null;
          review_comments?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          submitted_at?: string | null;
          submitted_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "succession_plans_critical_position_id_fkey";
            columns: ["critical_position_id"];
            isOneToOne: true;
            referencedRelation: "critical_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_plans_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      succession_qualification_requirements: {
        Row: {
          active: boolean;
          created_at: string;
          created_by: string | null;
          critical_position_id: string;
          description: string | null;
          id: string;
          is_demo: boolean;
          is_mandatory: boolean;
          name: string;
          updated_at: string;
          updated_by: string | null;
          version: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          critical_position_id: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          is_mandatory?: boolean;
          name: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
          critical_position_id?: string;
          description?: string | null;
          id?: string;
          is_demo?: boolean;
          is_mandatory?: boolean;
          name?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "succession_qualification_requirements_critical_position_id_fkey";
            columns: ["critical_position_id"];
            isOneToOne: false;
            referencedRelation: "critical_positions";
            referencedColumns: ["id"];
          },
        ];
      };
      succession_candidate_qualifications: {
        Row: {
          assessor_id: string | null;
          candidate_id: string;
          created_at: string;
          created_by: string | null;
          critical_position_id: string;
          evidence_date: string | null;
          evidence_summary: string | null;
          expires_on: string | null;
          id: string;
          is_demo: boolean;
          requirement_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          verified_at: string | null;
          version: number;
        };
        Insert: {
          assessor_id?: string | null;
          candidate_id: string;
          created_at?: string;
          created_by?: string | null;
          critical_position_id: string;
          evidence_date?: string | null;
          evidence_summary?: string | null;
          expires_on?: string | null;
          id?: string;
          is_demo?: boolean;
          requirement_id: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          verified_at?: string | null;
          version?: number;
        };
        Update: {
          assessor_id?: string | null;
          candidate_id?: string;
          created_at?: string;
          created_by?: string | null;
          critical_position_id?: string;
          evidence_date?: string | null;
          evidence_summary?: string | null;
          expires_on?: string | null;
          id?: string;
          is_demo?: boolean;
          requirement_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          verified_at?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "succession_candidate_qualifications_assessor_id_fkey";
            columns: ["assessor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_candidate_qualifications_candidate_id_critical_position_id_fkey";
            columns: ["candidate_id", "critical_position_id"];
            isOneToOne: false;
            referencedRelation: "succession_candidates";
            referencedColumns: ["id", "critical_position_id"];
          },
          {
            foreignKeyName: "succession_candidate_qualifications_requirement_id_critical_position_id_fkey";
            columns: ["requirement_id", "critical_position_id"];
            isOneToOne: false;
            referencedRelation: "succession_qualification_requirements";
            referencedColumns: ["id", "critical_position_id"];
          },
        ];
      };
      succession_development_activities: {
        Row: {
          candidate_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          development_plan_item_id: string | null;
          id: string;
          is_demo: boolean;
          status: string;
          target_date: string | null;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          development_plan_item_id?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          target_date?: string | null;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          development_plan_item_id?: string | null;
          id?: string;
          is_demo?: boolean;
          status?: string;
          target_date?: string | null;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "succession_development_activities_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "succession_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_development_activities_development_plan_item_id_fkey";
            columns: ["development_plan_item_id"];
            isOneToOne: false;
            referencedRelation: "development_plan_items";
            referencedColumns: ["id"];
          },
        ];
      };
      succession_readiness_assessments: {
        Row: {
          assessment_date: string;
          assessor_id: string | null;
          candidate_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_demo: boolean;
          readiness_class_id: string | null;
          summary: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assessment_date?: string;
          assessor_id?: string | null;
          candidate_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          readiness_class_id?: string | null;
          summary: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assessment_date?: string;
          assessor_id?: string | null;
          candidate_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_demo?: boolean;
          readiness_class_id?: string | null;
          summary?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "succession_readiness_assessments_assessor_id_fkey";
            columns: ["assessor_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_readiness_assessments_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "succession_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "succession_readiness_assessments_readiness_class_id_fkey";
            columns: ["readiness_class_id"];
            isOneToOne: false;
            referencedRelation: "readiness_classes";
            referencedColumns: ["id"];
          },
        ];
      };
      system_settings: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          key: string;
          requires_validation: boolean;
          updated_at: string;
          updated_by: string | null;
          value: Json;
          version: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key: string;
          requires_validation?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
          version?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          key?: string;
          requires_validation?: boolean;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
          version?: number;
        };
        Relationships: [];
      };
      trainers: {
        Row: {
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          is_demo: boolean;
          is_external: boolean;
          name: string;
          specialty: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_demo?: boolean;
          is_external?: boolean;
          name: string;
          specialty?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_demo?: boolean;
          is_external?: boolean;
          name?: string;
          specialty?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      training_attendance: {
        Row: {
          created_at: string;
          created_by: string | null;
          employee_id: string;
          id: string;
          is_demo: boolean;
          recorded_at: string;
          recorded_by: string | null;
          remarks: string | null;
          session_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          recorded_at?: string;
          recorded_by?: string | null;
          remarks?: string | null;
          session_id: string;
          status: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          recorded_at?: string;
          recorded_by?: string | null;
          remarks?: string | null;
          session_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_attendance_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_attendance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_effectiveness_reviews: {
        Row: {
          created_at: string;
          created_by: string | null;
          follow_up_notes: string | null;
          follow_up_required: boolean;
          id: string;
          is_demo: boolean;
          reviewer_id: string | null;
          session_id: string;
          summary: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          follow_up_notes?: string | null;
          follow_up_required?: boolean;
          id?: string;
          is_demo?: boolean;
          reviewer_id?: string | null;
          session_id: string;
          summary: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          follow_up_notes?: string | null;
          follow_up_required?: boolean;
          id?: string;
          is_demo?: boolean;
          reviewer_id?: string | null;
          session_id?: string;
          summary?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_effectiveness_reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_effectiveness_reviews_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_participants: {
        Row: {
          created_at: string;
          created_by: string | null;
          development_plan_item_id: string | null;
          employee_id: string;
          id: string;
          is_demo: boolean;
          session_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          development_plan_item_id?: string | null;
          employee_id: string;
          id?: string;
          is_demo?: boolean;
          session_id: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          development_plan_item_id?: string | null;
          employee_id?: string;
          id?: string;
          is_demo?: boolean;
          session_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_participants_development_plan_item_id_fkey";
            columns: ["development_plan_item_id"];
            isOneToOne: false;
            referencedRelation: "development_plan_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_participants_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_results: {
        Row: {
          created_at: string;
          created_by: string | null;
          employee_id: string;
          evidence: string | null;
          feedback: string | null;
          id: string;
          is_demo: boolean;
          outcome: string;
          recorded_by: string | null;
          score: number | null;
          session_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          employee_id: string;
          evidence?: string | null;
          feedback?: string | null;
          id?: string;
          is_demo?: boolean;
          outcome: string;
          recorded_by?: string | null;
          score?: number | null;
          session_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          employee_id?: string;
          evidence?: string | null;
          feedback?: string | null;
          id?: string;
          is_demo?: boolean;
          outcome?: string;
          recorded_by?: string | null;
          score?: number | null;
          session_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_results_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_results_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      training_sessions: {
        Row: {
          capacity: number | null;
          code: string;
          created_at: string;
          created_by: string | null;
          delivery_method: string;
          ends_at: string;
          id: string;
          is_demo: boolean;
          related_competency_id: string | null;
          starts_at: string;
          status: string;
          title: string;
          trainer_id: string | null;
          type: string;
          updated_at: string;
          updated_by: string | null;
          venue: string | null;
          version: number;
        };
        Insert: {
          capacity?: number | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          delivery_method?: string;
          ends_at: string;
          id?: string;
          is_demo?: boolean;
          related_competency_id?: string | null;
          starts_at: string;
          status?: string;
          title: string;
          trainer_id?: string | null;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue?: string | null;
          version?: number;
        };
        Update: {
          capacity?: number | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          delivery_method?: string;
          ends_at?: string;
          id?: string;
          is_demo?: boolean;
          related_competency_id?: string | null;
          starts_at?: string;
          status?: string;
          title?: string;
          trainer_id?: string | null;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
          venue?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "training_sessions_related_competency_id_fkey";
            columns: ["related_competency_id"];
            isOneToOne: false;
            referencedRelation: "competencies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "training_sessions_trainer_id_fkey";
            columns: ["trainer_id"];
            isOneToOne: false;
            referencedRelation: "trainers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _assert_succession_write: { Args: { _dept: string }; Returns: undefined };
      _build_snapshot: { Args: { _version_id: string }; Returns: Json };
      _idem_get: {
        Args: { _hash: string; _key: string; _op: string };
        Returns: Json;
      };
      _idem_put: {
        Args: { _hash: string; _key: string; _op: string; _resp: Json };
        Returns: Json;
      };
      _maybe_complete_course: {
        Args: { _enrollment: string };
        Returns: undefined;
      };
      _notify: {
        Args: {
          _body: string;
          _kind?: string;
          _link: string;
          _title: string;
          _user: string;
        };
        Returns: undefined;
      };
      _notify_role: {
        Args: {
          _body: string;
          _link: string;
          _role: Database["public"]["Enums"]["app_role"];
          _title: string;
        };
        Returns: undefined;
      };
      _snapshot_gaps: { Args: { _employee: string }; Returns: undefined };
      activate_profile_version: { Args: { _version_id: string }; Returns: Json };
      add_assessment_evidence: {
        Args: { _assessment: string; _file: string; _note: string };
        Returns: Json;
      };
      add_evaluation_evidence: {
        Args: {
          _assignment: string;
          _file: string;
          _item: string;
          _note: string;
        };
        Returns: Json;
      };
      admin_link_employee: {
        Args: { _employee: string; _user: string };
        Returns: Json;
      };
      admin_set_active: {
        Args: { _active: boolean; _user: string };
        Returns: Json;
      };
      admin_set_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _user: string };
        Returns: Json;
      };
      archive_course: { Args: { _id: string }; Returns: Json };
      acknowledge_evaluation: {
        Args: { _assignment: string; _comment: string; _hash: string; _idem: string };
        Returns: Json;
      };
      api_patch_course: {
        Args: {
          _expected_version: number;
          _hash: string;
          _id: string;
          _idem: string;
          _patch: Json;
        };
        Returns: Json;
      };
      assert_transition: {
        Args: { _entity: string; _from: string; _to: string };
        Returns: undefined;
      };
      can_access_file: { Args: { _file: string }; Returns: boolean };
      can_manage_learning: { Args: never; Returns: boolean };
      can_manage_team_member: { Args: { _emp: string }; Returns: boolean };
      can_manage_training: { Args: never; Returns: boolean };
      can_review_ai: { Args: never; Returns: boolean };
      can_view_comp: { Args: { _emp: string }; Returns: boolean };
      can_view_development: { Args: { _emp: string }; Returns: boolean };
      can_view_employee: { Args: { _emp: string }; Returns: boolean };
      can_view_perf: { Args: { _emp: string }; Returns: boolean };
      can_view_succession: { Args: { _dept: string }; Returns: boolean };
      competency_gaps: {
        Args: {
          _category?: string;
          _department?: string;
          _employee?: string;
          _limit?: number;
          _offset?: number;
          _position?: string;
          _status?: string;
        };
        Returns: {
          assessment_date: string;
          assessment_id: string;
          category_id: string;
          category_name: string;
          competency_id: string;
          competency_name: string;
          current_level: number;
          department_id: string;
          department_name: string;
          employee_code: string;
          employee_id: string;
          employee_name: string;
          evidence_summary: string;
          gap: number;
          gap_status: string;
          is_mandatory: boolean;
          is_safety_critical: boolean;
          position_id: string;
          position_title: string;
          required_level: number;
        }[];
      };
      compute_evaluation_score: {
        Args: { _assignment: string };
        Returns: number;
      };
      course_visible: { Args: { _course: string }; Returns: boolean };
      create_assignments: {
        Args: {
          _cycle: string;
          _employees: string[];
          _hash: string;
          _idem: string;
        };
        Returns: Json;
      };
      create_profile: {
        Args: { _desc: string; _name: string; _position: string };
        Returns: Json;
      };
      current_role_name: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      enroll_course: {
        Args: {
          _course: string;
          _due_date: string | null;
          _employee: string;
          _hash: string;
          _idem: string;
          _plan_item: string;
          _source: string;
        };
        Returns: Json;
      };
      get_quiz_questions: { Args: { _quiz: string }; Returns: Json };
      global_search: {
        Args: { _q: string };
        Returns: {
          id: string;
          kind: string;
          label: string;
          link: string;
          sublabel: string;
        }[];
      };
      grant_succession_access: {
        Args: { _department: string; _user: string };
        Returns: Json;
      };
      has_perm: { Args: { _perm: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_dept_head_of: { Args: { _emp: string }; Returns: boolean };
      is_supervisor_of: { Args: { _emp: string }; Returns: boolean };
      link_reassessment: {
        Args: {
          _assessment: string;
          _competency: string;
          _employee: string;
          _notes: string;
          _session: string;
        };
        Returns: Json;
      };
      log_ai_generation: {
        Args: {
          _employee: string;
          _error: string;
          _latency: number;
          _model: string;
          _status: string;
        };
        Returns: Json;
      };
      log_audit: {
        Args: {
          _action: string;
          _details: Json;
          _record: string;
          _table: string;
        };
        Returns: undefined;
      };
      log_succession_view: {
        Args: { _record: string; _record_type: string };
        Returns: Json;
      };
      log_report_view: { Args: { _filters: Json; _kind: string }; Returns: Json };
      mark_notifications_read: { Args: { _ids: string[] }; Returns: Json };
      my_context: { Args: never; Returns: Json };
      my_employee_id: { Args: never; Returns: string };
      new_profile_version: { Args: { _profile: string }; Returns: Json };
      prepare_ai_context: { Args: { _employee: string }; Returns: Json };
      process_outbox: { Args: { _limit?: number }; Returns: Json };
      profile_weight_total: { Args: { _version_id: string }; Returns: number };
      register_file: {
        Args: {
          _employee: string;
          _mime: string;
          _name: string;
          _path: string;
          _size: number;
        };
        Returns: Json;
      };
      register_participant: {
        Args: { _employee: string; _plan_item: string; _session: string };
        Returns: Json;
      };
      remove_demo_data: { Args: never; Returns: Json };
      reopen_evaluation: {
        Args: {
          _assignment: string;
          _hash: string;
          _idem: string;
          _reason: string;
        };
        Returns: Json;
      };
      record_report_export: {
        Args: {
          _format: string;
          _hash: string;
          _idem: string;
          _kind: string;
          _name: string;
          _result: string;
          _row_count: number;
          _scope: Json;
        };
        Returns: Json;
      };
      report_data: {
        Args: {
          _department?: string;
          _from?: string;
          _kind: string;
          _to?: string;
        };
        delete_saved_report: {
          Args: { _hash: string; _id: string; _idem: string; _version: number };
          Returns: Json;
        };
        upsert_saved_report: {
          Args: {
            _columns: string[];
            _filters: Json;
            _hash: string;
            _id: string | null;
            _idem: string;
            _kind: string;
            _name: string;
            _version: number | null;
          };
          Returns: Json;
        };
        _assert_report_access: { Args: { _kind: string }; Returns: undefined };
        Returns: Json;
      };
      reset_demo_data: { Args: never; Returns: Json };
      review_ai_recommendation: {
        Args: {
          _comments: string;
          _decision: string;
          _edited: Json;
          _hash: string;
          _id: string;
          _idem: string;
        };
        Returns: Json;
      };
      review_assessment: {
        Args: {
          _comments: string;
          _decision: string;
          _hash: string;
          _id: string;
          _idem: string;
        };
        Returns: Json;
      };
      review_course: {
        Args: {
          _comments: string;
          _decision: string;
          _hash: string;
          _id: string;
          _idem: string;
        };
        Returns: Json;
      };
      review_evaluation: {
        Args: {
          _assignment: string;
          _comments: string;
          _decision: string;
          _hash: string;
          _idem: string;
        };
        Returns: Json;
      };
      review_nomination: {
        Args: {
          _comments: string;
          _decision: string;
          _hash: string;
          _id: string;
          _idem: string;
          _show_nominator: boolean;
          _visibility: string;
        };
        Returns: Json;
      };
      revoke_succession_access: { Args: { _grant: string }; Returns: Json };
      save_ai_recommendations: {
        Args: {
          _employee: string;
          _hash: string;
          _idem: string;
          _items: Json;
          _model: string;
        };
        Returns: Json;
      };
      save_assessment: {
        Args: {
          _comments: string;
          _competency: string;
          _employee: string;
          _evidence: string;
          _id: string;
          _level: number;
          _reassess: boolean;
          _version: number;
        };
        Returns: Json;
      };
      save_attendance: {
        Args: { _hash: string; _idem: string; _rows: Json; _session: string };
        Returns: Json;
      };
      save_course_content: {
        Args: { _course: string; _sections: Json; _version: number };
        Returns: Json;
      };
      save_effectiveness_review: {
        Args: {
          _follow_up: boolean;
          _notes: string;
          _session: string;
          _summary: string;
        };
        Returns: Json;
      };
      save_evaluation: {
        Args: {
          _assignment: string;
          _expected: number;
          _overall_comment: string;
          _respondent: string;
          _responses: Json;
        };
        Returns: Json;
      };
      save_lesson_progress: {
        Args: { _completed: boolean; _enrollment: string; _lesson: string };
        Returns: Json;
      };
      save_plan_item: {
        Args: { _d: Json; _id: string; _plan: string; _version: number };
        Returns: Json;
      };
      save_profile_version: {
        Args: { _c: Json; _expected: number; _version_id: string };
        Returns: Json;
      };
      save_readiness_assessment: {
        Args: { _candidate: string; _class: string; _summary: string };
        Returns: Json;
      };
      save_succession_activity: {
        Args: { _candidate: string; _d: Json; _id: string };
        Returns: Json;
      };
      set_succession_candidate_qualification: {
        Args: {
          _candidate: string;
          _evidence: string;
          _evidence_date: string;
          _expires_on: string;
          _hash: string;
          _id: string;
          _idem: string;
          _requirement: string;
          _status: string;
          _version: number;
        };
        Returns: Json;
      };
      save_training_result: {
        Args: { _d: Json; _employee: string; _session: string };
        Returns: Json;
      };
      set_course_competencies: {
        Args: { _course: string; _mappings: Json };
        Returns: Json;
      };
      set_cycle_status: {
        Args: { _id: string; _status: string };
        Returns: Json;
      };
      set_path_courses: {
        Args: { _course_ids: Json; _path: string };
        Returns: Json;
      };
      set_plan_item_status: {
        Args: { _evidence: string; _item: string; _status: string };
        Returns: Json;
      };
      set_position_requirement: {
        Args: {
          _competency: string;
          _level: number;
          _mandatory: boolean;
          _position: string;
          _reason: string;
          _remove: boolean;
          _safety: boolean;
        };
        Returns: Json;
      };
      set_session_status: {
        Args: { _id: string; _status: string };
        Returns: Json;
      };
      set_supervisor: {
        Args: { _emp: string; _from: string; _sup: string };
        Returns: Json;
      };
      snapshot_gaps: { Args: { _employee: string }; Returns: Json };
      submit_assessment: {
        Args: { _hash: string; _id: string; _idem: string };
        Returns: Json;
      };
      submit_course: {
        Args: { _hash: string; _id: string; _idem: string };
        Returns: Json;
      };
      submit_development_plan: {
        Args: { _hash: string; _id: string; _idem: string; _version: number };
        Returns: Json;
      };
      review_development_plan: {
        Args: {
          _comments: string;
          _decision: string;
          _hash: string;
          _id: string;
          _idem: string;
          _version: number;
        };
        Returns: Json;
      };
      submit_succession_plan: {
        Args: { _hash: string; _id: string; _idem: string; _version: number };
        Returns: Json;
      };
      review_succession_plan: {
        Args: {
          _comments: string;
          _decision: string;
          _hash: string;
          _id: string;
          _idem: string;
          _version: number;
        };
        Returns: Json;
      };
      submit_evaluation: {
        Args: {
          _assignment: string;
          _hash: string;
          _idem: string;
          _respondent: string;
        };
        Returns: Json;
      };
      submit_nomination: {
        Args: {
          _category: string;
          _hash: string;
          _idem: string;
          _message: string;
          _recipient: string;
          _supporting: string;
        };
        Returns: Json;
      };
      submit_quiz_attempt: {
        Args: {
          _answers: Json;
          _enrollment: string;
          _hash: string;
          _idem: string;
          _quiz: string;
        };
        Returns: Json;
      };
      update_ai_settings: {
        Args: { _model: string; _provider: string; _version: number };
        Returns: Json;
      };
      update_my_contact: {
        Args: { _phone: string; _version: number };
        Returns: Json;
      };
      update_proficiency_level: {
        Args: {
          _desc: string;
          _label: string;
          _level: number;
          _version: number;
        };
        Returns: Json;
      };
      update_setting: {
        Args: { _key: string; _value: Json; _version: number };
        Returns: Json;
      };
      upsert_category: {
        Args: { _desc: string; _id: string; _name: string };
        Returns: Json;
      };
      upsert_competency: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_course: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_critical_position: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_succession_qualification_requirement: {
        Args: {
          _active: boolean;
          _critical_position: string;
          _description: string;
          _hash: string;
          _id: string;
          _idem: string;
          _mandatory: boolean;
          _name: string;
          _version: number;
        };
        Returns: Json;
      };
      upsert_cycle: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_department: {
        Args: {
          _code: string;
          _head: string;
          _id: string;
          _name: string;
          _parent: string;
          _status: string;
          _version: number;
        };
        Returns: Json;
      };
      upsert_development_plan: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_personal_goal: {
        Args: { _d: Json; _hash: string; _id: string; _idem: string; _version: number };
        Returns: Json;
      };
      submit_personal_goal: {
        Args: { _hash: string; _id: string; _idem: string; _version: number };
        Returns: Json;
      };
      update_personal_goal_progress: {
        Args: {
          _comment: string;
          _hash: string;
          _id: string;
          _idem: string;
          _progress: number;
          _version: number;
        };
        Returns: Json;
      };
      review_personal_goal: {
        Args: { _comments: string; _decision: string; _hash: string; _id: string; _idem: string };
        Returns: Json;
      };
      upsert_employee: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_learning_path: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_position: {
        Args: {
          _code: string;
          _dept: string;
          _desc: string;
          _id: string;
          _status: string;
          _title: string;
          _version: number;
        };
        Returns: Json;
      };
      upsert_readiness_class: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_recognition_category: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_succession_candidate: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_trainer: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
      upsert_training_session: {
        Args: { _d: Json; _id: string; _version: number };
        Returns: Json;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "hr_admin"
        | "dept_head"
        | "supervisor"
        | "employee"
        | "ops_manager";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "admin",
        "hr_admin",
        "dept_head",
        "supervisor",
        "employee",
        "ops_manager",
      ],
    },
  },
} as const;
