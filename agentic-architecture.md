# Agentic AI Reference Architecture

A layered reference architecture for agentic AI systems, illustrating orchestration, multi-model routing, skills, RAG, tool use, and safety patterns.
---
```mermaid
flowchart TB
    subgraph ui [User Interface]
        ChatUI["Chat UI"]
        APIGw["API Gateway"]
        Events["Event Triggers"]
    end

    subgraph orch [Orchestration]
        Guards["Guardrails<br/>Policy and Validation"]
        Agent["Primary Agent<br/>LLM: Claude Opus"]
        Router["Planner / Router<br/>Task Decomposition"]
        HITL["Human-in-the-Loop<br/>Approvals and Feedback"]
        Mem["Context and Memory<br/>Session | Long-term | Shared"]
    end

    subgraph subs [Subagent Pool - Parallel Execution]
        Research["Research Agent<br/>LLM: Opus"]
        Code["Code Agent<br/>LLM: Sonnet"]
        Analysis["Analysis Agent<br/>LLM: Haiku"]
        Domain["Domain Expert<br/>LLM: Fine-tuned"]
    end

    subgraph caps [Skills and Capabilities]
        Skills["Skill Library<br/>Reports | Parsing | Dashboards"]
        RAG["RAG Pipeline<br/>Rewrite | Retrieve | Rerank"]
        Sandbox["Code Execution<br/>Sandboxed Runtime"]
    end

    subgraph infra [Tools and Infrastructure]
        MCP["MCP Servers"]
        VecDB["Vector Store"]
        Docs["Document Store"]
        APIs["External APIs"]
        Files["File System"]
    end

    ChatUI --> Guards
    APIGw --> Guards
    Events --> Guards

    Guards <--> Agent
    Agent <--> HITL
    Agent <--> Mem
    Agent --> Router

    Router -->|delegate| Research
    Router -->|delegate| Code
    Router -->|delegate| Analysis
    Router -->|delegate| Domain

    Research --> Skills
    Research --> RAG
    Code --> Skills
    Code --> Sandbox
    Analysis --> RAG
    Domain --> Skills

    RAG --> VecDB
    RAG --> Docs
    Skills --> MCP
    Sandbox --> Files
    MCP --> APIs
```
---
## Architecture Layers

### 1. User Interface
Entry points into the agentic system. Users interact via conversational chat, programmatic API calls, or automated event triggers (scheduled jobs, webhooks).

### 2. Orchestration
The core coordination layer powered by the **primary LLM**. The Primary Agent receives requests (filtered through guardrails), decomposes them via the Planner/Router, and delegates work to specialized subagents. Human-in-the-loop gates allow approval, escalation, and feedback for high-stakes decisions. Shared context and memory persist across sessions and are available to all downstream agents.

### 3. Subagent Pool
Specialized agents that execute delegated tasks **in parallel** when independent. Each subagent can use a **different LLM** optimized for its role: a high-capability model for deep research, a fast/cost-efficient model for code generation, a lightweight model for high-volume analysis, or a fine-tuned model for domain-specific expertise.

### 4. Skills and Capabilities
Reusable capability modules that subagents invoke. The **Skill Library** provides packaged workflows (report generation, log parsing, dashboard building). The **RAG Pipeline** handles retrieval-augmented generation: query rewriting, vector retrieval, reranking, and context injection. **Code Execution** provides a sandboxed runtime for running generated code safely.

### 5. Tools and Infrastructure
The foundational services that skills and agents interact with. **MCP Servers** provide standardized tool integrations across APIs, SaaS platforms, and databases. **Vector and Document Stores** back the RAG pipeline. **External APIs** and the **File System** provide additional reach into the environment.
---
## Key Architectural Patterns

| Pattern | Where It Appears |
|---|---|
| Orchestrator delegation | Primary Agent decomposes and routes to subagents |
| Multi-model routing | Each subagent selects the optimal LLM for cost, speed, or capability |
| Parallel execution | Independent subagents run concurrently |
| Reusable skills | Shared Skill Library invoked by any subagent |
| Retrieval-augmented generation | RAG Pipeline connects to Vector Store and Document Store |
| Human-in-the-loop | Approval gates and feedback loops at the orchestration layer |
| Guardrails | Input/output validation and policy enforcement at the boundary |
| Shared memory | Context persistence across agents, sessions, and tasks |
| Tool abstraction (MCP) | Standardized protocol for integrating external tools and services |
