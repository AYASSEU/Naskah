
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "app_config": {
                  Row: {
                    "description": string,"key": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"key": string,"value": NonNullable<Json>
                  }
                  Update: {
                    "description"?: string,"key"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"created_at": string,"detail": NonNullable<Json>,"id": number,"owner_id": string,"resource": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"owner_id": string,"resource": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"owner_id"?: string,"resource"?: string
                  }
                  Relationships: [
                    
                  ]
                },"blind_assignments": {
                  Row: {
                    "id": string,"is_thesis_run": boolean,"label": string,"markdown": string,"owner_id": string,"participant_id": string,"project_id": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_thesis_run"?: boolean,"label": string,"markdown": string,"owner_id": string,"participant_id": string,"project_id": string,"source": string
                  }
                  Update: {
                    "id"?: string,"is_thesis_run"?: boolean,"label"?: string,"markdown"?: string,"owner_id"?: string,"participant_id"?: string,"project_id"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blind_assignments_participant_id_owner_id_fkey"
      columns: ["participant_id","owner_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "blind_assignments_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"callback_receipts": {
                  Row: {
                    "created_at": string,"event_id": string,"kind": string,"owner_id": string,"payload_hash": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"kind": string,"owner_id": string,"payload_hash": string,"session_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"kind"?: string,"owner_id"?: string,"payload_hash"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "callback_receipts_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "srs_generation_logs"
      referencedColumns: ["session_id"]
    }
                  ]
                },"document_versions": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"owner_id": string,"project_id": string,"sections": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label": string,"owner_id": string,"project_id": string,"sections": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"owner_id"?: string,"project_id"?: string,"sections"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "document_versions_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"documents": {
                  Row: {
                    "chunks": NonNullable<Json>,"metadata": NonNullable<Json>,"owner_id": string,"project_id": string,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chunks"?: NonNullable<Json>,"metadata"?: NonNullable<Json>,"owner_id": string,"project_id": string,"template_id": string
                  }
                  Update: {
                    "chunks"?: NonNullable<Json>,"metadata"?: NonNullable<Json>,"owner_id"?: string,"project_id"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "documents_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"expert_reviews": {
                  Row: {
                    "assignment_id": string,"comments": string,"created_at": string,"id": string,"is_thesis_run": boolean,"justifications": NonNullable<Json>,"label": string,"owner_id": string,"participant_id": string,"ratings": NonNullable<Json>,"reviewer": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"comments"?: string,"created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"justifications": NonNullable<Json>,"label": string,"owner_id": string,"participant_id": string,"ratings": NonNullable<Json>,"reviewer": string
                  }
                  Update: {
                    "assignment_id"?: string,"comments"?: string,"created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"justifications"?: NonNullable<Json>,"label"?: string,"owner_id"?: string,"participant_id"?: string,"ratings"?: NonNullable<Json>,"reviewer"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "expert_reviews_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: true
      referencedRelation: "blind_assignments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "expert_reviews_participant_id_owner_id_fkey"
      columns: ["participant_id","owner_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"exports": {
                  Row: {
                    "created_at": string,"filename": string,"format": string,"id": string,"object_path": string,"owner_id": string,"project_id": string,"size": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filename": string,"format": string,"id"?: string,"object_path": string,"owner_id": string,"project_id": string,"size": number
                  }
                  Update: {
                    "created_at"?: string,"filename"?: string,"format"?: string,"id"?: string,"object_path"?: string,"owner_id"?: string,"project_id"?: string,"size"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "exports_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"generation_events": {
                  Row: {
                    "created_at": string,"event_id": string,"owner_id": string,"payload": NonNullable<Json>,"scope": string,"scope_ref": string | null,"seq": number,"session_id": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"owner_id": string,"payload": NonNullable<Json>,"scope": string,"scope_ref"?: string | null,"seq"?: never,"session_id": string,"type": string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"owner_id"?: string,"payload"?: NonNullable<Json>,"scope"?: string,"scope_ref"?: string | null,"seq"?: never,"session_id"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "generation_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "srs_generation_logs"
      referencedColumns: ["session_id"]
    }
                  ]
                },"ground_truth_docs": {
                  Row: {
                    "content": string,"created_at": string,"dataset_source": string,"doc_id": string,"language": string,"metadata": NonNullable<Json>,"owner_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"created_at"?: string,"dataset_source": string,"doc_id": string,"language": string,"metadata"?: NonNullable<Json>,"owner_id": string
                  }
                  Update: {
                    "content"?: string,"created_at"?: string,"dataset_source"?: string,"doc_id"?: string,"language"?: string,"metadata"?: NonNullable<Json>,"owner_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"guardrail_reports": {
                  Row: {
                    "created_at": string,"dimensions": NonNullable<Json>,"id": string,"owner_id": string,"rewrites": NonNullable<Json>,"section_id": string,"session_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"dimensions": NonNullable<Json>,"id"?: string,"owner_id": string,"rewrites"?: NonNullable<Json>,"section_id": string,"session_id": string
                  }
                  Update: {
                    "created_at"?: string,"dimensions"?: NonNullable<Json>,"id"?: string,"owner_id"?: string,"rewrites"?: NonNullable<Json>,"section_id"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardrail_reports_section_id_fkey"
      columns: ["section_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardrail_reports_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "srs_generation_logs"
      referencedColumns: ["session_id"]
    }
                  ]
                },"ingestion_runs": {
                  Row: {
                    "cost_estimate": number | null,"counts": NonNullable<Json>,"created_at": string,"dataset_source": string,"dimensions": number,"embedding_model": string,"finished_at": string | null,"id": string,"manifest": NonNullable<Json>,"owner_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_estimate"?: number | null,"counts"?: NonNullable<Json>,"created_at"?: string,"dataset_source": string,"dimensions": number,"embedding_model": string,"finished_at"?: string | null,"id"?: string,"manifest"?: NonNullable<Json>,"owner_id": string,"status": string
                  }
                  Update: {
                    "cost_estimate"?: number | null,"counts"?: NonNullable<Json>,"created_at"?: string,"dataset_source"?: string,"dimensions"?: number,"embedding_model"?: string,"finished_at"?: string | null,"id"?: string,"manifest"?: NonNullable<Json>,"owner_id"?: string,"status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"integration_secrets": {
                  Row: {
                    "ciphertext": string,"config": NonNullable<Json>,"iv": string,"key_hint": string,"key_version": number,"last_error_code": string | null,"last_tested_at": string | null,"owner_id": string,"provider": string,"status": string,"tag": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ciphertext": string,"config"?: NonNullable<Json>,"iv": string,"key_hint": string,"key_version"?: number,"last_error_code"?: string | null,"last_tested_at"?: string | null,"owner_id": string,"provider": string,"status"?: string,"tag": string,"updated_at"?: string
                  }
                  Update: {
                    "ciphertext"?: string,"config"?: NonNullable<Json>,"iv"?: string,"key_hint"?: string,"key_version"?: number,"last_error_code"?: string | null,"last_tested_at"?: string | null,"owner_id"?: string,"provider"?: string,"status"?: string,"tag"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"n8n_bindings": {
                  Row: {
                    "credential_id": string | null,"credential_name": string,"credential_type": string,"last_tested_at": string | null,"owner_id": string,"provider": string,"rebound": NonNullable<Json>,"status": string,"updated_at": string,"workflows": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "credential_id"?: string | null,"credential_name": string,"credential_type": string,"last_tested_at"?: string | null,"owner_id": string,"provider": string,"rebound"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"workflows"?: NonNullable<Json>
                  }
                  Update: {
                    "credential_id"?: string | null,"credential_name"?: string,"credential_type"?: string,"last_tested_at"?: string | null,"owner_id"?: string,"provider"?: string,"rebound"?: NonNullable<Json>,"status"?: string,"updated_at"?: string,"workflows"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"participants": {
                  Row: {
                    "code": string,"consent": boolean,"consent_at": string,"created_at": string,"id": string,"owner_id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"consent": boolean,"consent_at": string,"created_at"?: string,"id"?: string,"owner_id": string,"role": string
                  }
                  Update: {
                    "code"?: string,"consent"?: boolean,"consent_at"?: string,"created_at"?: string,"id"?: string,"owner_id"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"project_inputs": {
                  Row: {
                    "created_at": string,"files": NonNullable<Json>,"id": string,"owner_id": string,"project_id": string,"raw_text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"files"?: NonNullable<Json>,"id"?: string,"owner_id": string,"project_id": string,"raw_text"?: string
                  }
                  Update: {
                    "created_at"?: string,"files"?: NonNullable<Json>,"id"?: string,"owner_id"?: string,"project_id"?: string,"raw_text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "project_inputs_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"domain": string,"id": string,"output_language": string,"owner_id": string,"raw_text": string,"session_id": string,"status": string,"template_id": string,"title": string,"updated_at": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"domain": string,"id"?: string,"output_language"?: string,"owner_id": string,"raw_text"?: string,"session_id"?: string,"status"?: string,"template_id"?: string,"title": string,"updated_at"?: string,"version"?: string
                  }
                  Update: {
                    "created_at"?: string,"domain"?: string,"id"?: string,"output_language"?: string,"owner_id"?: string,"raw_text"?: string,"session_id"?: string,"status"?: string,"template_id"?: string,"title"?: string,"updated_at"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                },"prompt_templates": {
                  Row: {
                    "active": boolean,"body": string,"chapter": string,"id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"body": string,"chapter": string,"id": string,"version": number
                  }
                  Update: {
                    "active"?: boolean,"body"?: string,"chapter"?: string,"id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"retrieved_chunk_log": {
                  Row: {
                    "chunk_id": number | null,"id": number,"owner_id": string,"provenance": NonNullable<Json>,"section_id": string | null,"session_id": string,"similarity": number
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_id"?: number | null,"id"?: never,"owner_id": string,"provenance"?: NonNullable<Json>,"section_id"?: string | null,"session_id": string,"similarity": number
                  }
                  Update: {
                    "chunk_id"?: number | null,"id"?: never,"owner_id"?: string,"provenance"?: NonNullable<Json>,"section_id"?: string | null,"session_id"?: string,"similarity"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "retrieved_chunk_log_chunk_id_fkey"
      columns: ["chunk_id"]
isOneToOne: false
      referencedRelation: "srs_knowledge_base"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retrieved_chunk_log_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "srs_generation_logs"
      referencedColumns: ["session_id"]
    }
                  ]
                },"revision_proposals": {
                  Row: {
                    "after_text": string | null,"base_section_version": number,"before_text": string,"created_at": string,"error_code": string | null,"guardrail": NonNullable<Json>,"id": string,"instruction": string,"n8n_execution_id": string | null,"owner_id": string,"project_id": string,"refined_query": string,"retrieved_chunks": NonNullable<Json>,"section_id": string,"session_id": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "after_text"?: string | null,"base_section_version": number,"before_text": string,"created_at"?: string,"error_code"?: string | null,"guardrail"?: NonNullable<Json>,"id"?: string,"instruction": string,"n8n_execution_id"?: string | null,"owner_id": string,"project_id": string,"refined_query"?: string,"retrieved_chunks"?: NonNullable<Json>,"section_id": string,"session_id": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "after_text"?: string | null,"base_section_version"?: number,"before_text"?: string,"created_at"?: string,"error_code"?: string | null,"guardrail"?: NonNullable<Json>,"id"?: string,"instruction"?: string,"n8n_execution_id"?: string | null,"owner_id"?: string,"project_id"?: string,"refined_query"?: string,"retrieved_chunks"?: NonNullable<Json>,"section_id"?: string,"session_id"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "revision_proposals_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "revision_proposals_section_id_owner_id_fkey"
      columns: ["section_id","owner_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"rouge_results": {
                  Row: {
                    "created_at": string,"id": string,"is_thesis_run": boolean,"language": string,"language_mismatch_override": boolean,"owner_id": string,"project_id": string | null,"provenance": NonNullable<Json>,"reference_language": string,"rouge_l": NonNullable<Json>,"rouge1": NonNullable<Json>,"rouge2": NonNullable<Json>,"scenario": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"language": string,"language_mismatch_override"?: boolean,"owner_id": string,"project_id"?: string | null,"provenance"?: NonNullable<Json>,"reference_language": string,"rouge_l": NonNullable<Json>,"rouge1": NonNullable<Json>,"rouge2": NonNullable<Json>,"scenario": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"language"?: string,"language_mismatch_override"?: boolean,"owner_id"?: string,"project_id"?: string | null,"provenance"?: NonNullable<Json>,"reference_language"?: string,"rouge_l"?: NonNullable<Json>,"rouge1"?: NonNullable<Json>,"rouge2"?: NonNullable<Json>,"scenario"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rouge_results_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"section_versions": {
                  Row: {
                    "created_at": string,"id": string,"label": string,"owner_id": string,"section_id": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"label"?: string,"owner_id": string,"section_id": string,"snapshot": NonNullable<Json>,"version": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"label"?: string,"owner_id"?: string,"section_id"?: string,"snapshot"?: NonNullable<Json>,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "section_versions_section_id_owner_id_fkey"
      columns: ["section_id","owner_id"]
isOneToOne: false
      referencedRelation: "sections"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"sections": {
                  Row: {
                    "guardrail": NonNullable<Json>,"id": string,"locked": boolean,"markdown": string,"number": string,"owner_id": string,"project_id": string,"requirements": NonNullable<Json>,"section_id": string,"source": string,"status": string,"title": string,"updated_at": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "guardrail"?: NonNullable<Json>,"id"?: string,"locked"?: boolean,"markdown"?: string,"number": string,"owner_id": string,"project_id": string,"requirements"?: NonNullable<Json>,"section_id": string,"source"?: string,"status"?: string,"title": string,"updated_at"?: string,"version"?: number
                  }
                  Update: {
                    "guardrail"?: NonNullable<Json>,"id"?: string,"locked"?: boolean,"markdown"?: string,"number"?: string,"owner_id"?: string,"project_id"?: string,"requirements"?: NonNullable<Json>,"section_id"?: string,"source"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sections_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"srs_generation_logs": {
                  Row: {
                    "cancel_requested": boolean,"completed_sections": NonNullable<Json>,"created_at": string,"current_stage": string | null,"domain": string,"embedding_model": string | null,"error_code": string | null,"error_message": string | null,"execution_time_seconds": number,"failure_stage": string | null,"finished_at": string | null,"guardrail_rewrite_count": number,"is_thesis_run": boolean,"metrics": NonNullable<Json>,"model": string | null,"n8n_execution_id": string | null,"owner_id": string,"project_id": string,"project_title": string,"retrieval_k": number | null,"run_id": string,"run_status_detail": string | null,"scenario_label": string | null,"session_id": string,"status": string,"structure_completeness_pct": number,"tokens_in": number,"tokens_out": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_requested"?: boolean,"completed_sections"?: NonNullable<Json>,"created_at"?: string,"current_stage"?: string | null,"domain": string,"embedding_model"?: string | null,"error_code"?: string | null,"error_message"?: string | null,"execution_time_seconds"?: number,"failure_stage"?: string | null,"finished_at"?: string | null,"guardrail_rewrite_count"?: number,"is_thesis_run"?: boolean,"metrics"?: NonNullable<Json>,"model"?: string | null,"n8n_execution_id"?: string | null,"owner_id": string,"project_id": string,"project_title": string,"retrieval_k"?: number | null,"run_id"?: string,"run_status_detail"?: string | null,"scenario_label"?: string | null,"session_id"?: string,"status"?: string,"structure_completeness_pct"?: number,"tokens_in"?: number,"tokens_out"?: number,"updated_at"?: string
                  }
                  Update: {
                    "cancel_requested"?: boolean,"completed_sections"?: NonNullable<Json>,"created_at"?: string,"current_stage"?: string | null,"domain"?: string,"embedding_model"?: string | null,"error_code"?: string | null,"error_message"?: string | null,"execution_time_seconds"?: number,"failure_stage"?: string | null,"finished_at"?: string | null,"guardrail_rewrite_count"?: number,"is_thesis_run"?: boolean,"metrics"?: NonNullable<Json>,"model"?: string | null,"n8n_execution_id"?: string | null,"owner_id"?: string,"project_id"?: string,"project_title"?: string,"retrieval_k"?: number | null,"run_id"?: string,"run_status_detail"?: string | null,"scenario_label"?: string | null,"session_id"?: string,"status"?: string,"structure_completeness_pct"?: number,"tokens_in"?: number,"tokens_out"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "srs_generation_logs_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                },"srs_knowledge_base": {
                  Row: {
                    "chunk_index": number,"content": string,"content_hash": string,"created_at": string,"dataset_source": string,"dimensions": number,"doc_id": string,"domain": string | null,"embedding": string,"embedding_model": string,"id": number,"ieee_section": string,"ingestion_run_id": string | null,"metadata": NonNullable<Json>,"owner_id": string,"split": string,"token_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "chunk_index": number,"content": string,"content_hash": string,"created_at"?: string,"dataset_source": string,"dimensions"?: number,"doc_id": string,"domain"?: string | null,"embedding": string,"embedding_model": string,"id"?: number,"ieee_section"?: string,"ingestion_run_id"?: string | null,"metadata"?: NonNullable<Json>,"owner_id": string,"split"?: string,"token_count": number
                  }
                  Update: {
                    "chunk_index"?: number,"content"?: string,"content_hash"?: string,"created_at"?: string,"dataset_source"?: string,"dimensions"?: number,"doc_id"?: string,"domain"?: string | null,"embedding"?: string,"embedding_model"?: string,"id"?: number,"ieee_section"?: string,"ingestion_run_id"?: string | null,"metadata"?: NonNullable<Json>,"owner_id"?: string,"split"?: string,"token_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "srs_knowledge_base_ingestion_run_id_fkey"
      columns: ["ingestion_run_id"]
isOneToOne: false
      referencedRelation: "ingestion_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"statistical_results": {
                  Row: {
                    "created_at": string,"id": string,"is_thesis_run": boolean,"owner_id": string,"result": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"owner_id": string,"result": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"owner_id"?: string,"result"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"sus_responses": {
                  Row: {
                    "answers": NonNullable<Json>,"comment": string,"created_at": string,"id": string,"is_thesis_run": boolean,"owner_id": string,"participant_id": string,"project_id": string | null,"score": number
                  }
                  ComputedFields: never
                  Insert: {
                    "answers": NonNullable<Json>,"comment"?: string,"created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"owner_id": string,"participant_id": string,"project_id"?: string | null,"score": number
                  }
                  Update: {
                    "answers"?: NonNullable<Json>,"comment"?: string,"created_at"?: string,"id"?: string,"is_thesis_run"?: boolean,"owner_id"?: string,"participant_id"?: string,"project_id"?: string | null,"score"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sus_responses_participant_id_owner_id_fkey"
      columns: ["participant_id","owner_id"]
isOneToOne: false
      referencedRelation: "participants"
      referencedColumns: ["id","owner_id"]
    },{
      foreignKeyName: "sus_responses_project_id_owner_id_fkey"
      columns: ["project_id","owner_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id","owner_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_revision":
{ Args: { "p_owner": string,"p_revision": string }; Returns: {
              "guardrail": NonNullable<Json>,
"id": string,
"locked": boolean,
"markdown": string,
"number": string,
"owner_id": string,
"project_id": string,
"requirements": NonNullable<Json>,
"section_id": string,
"source": string,
"status": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "sections"
        isOneToOne: true
        isSetofReturn: false
      } },
"match_srs_chunks":
{ Args: { "expected_model"?: string,"filter_domain"?: string,"filter_section"?: string,"match_count"?: number,"query_embedding": string }; Returns: {
              "content": string,"id": number,"metadata": Json,"similarity": number
            }[]
                           },
"save_section":
{ Args: { "p_data": Json,"p_owner": string,"p_project": string,"p_section": string,"p_version": number }; Returns: {
              "guardrail": NonNullable<Json>,
"id": string,
"locked": boolean,
"markdown": string,
"number": string,
"owner_id": string,
"project_id": string,
"requirements": NonNullable<Json>,
"section_id": string,
"source": string,
"status": string,
"title": string,
"updated_at": string,
"version": number
            }
                          SetofOptions: {
        from: "*"
        to: "sections"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
