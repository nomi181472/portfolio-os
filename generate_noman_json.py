import json
import os

portfolio = {
  "schemaVersion": "1.0",
  "exampleContent": False,
  "profile": {
    "name": "Noman Ali",
    "discipline": "Solutions Architecture & Distributed Systems",
    "positioning": "Solutions Architect with 5+ years of experience designing and engineering high-throughput, low-latency distributed systems using polyglot microservices (Go, C#, Python) and cloud-native Kubernetes platforms. Skilled at decomposing legacy monoliths into scalable, multi-tenant architectures and modernizing enterprise systems for demanding real-time workloads, with a focus on reliability, performance, and scalability.",
    "location": "Karachi, Pakistan",
    "avatar": "/media/profilep.jpeg",
    "email": "nomansoomro51@gmail.com",
    "briefing": {
      "focus": "Designing and engineering high-throughput, low-latency distributed systems using polyglot microservices (Go, C#, Python) and cloud-native Kubernetes platforms, with a focus on reliability, performance, and scalability.",
      "domains": [
        "Distributed Systems Architecture",
        "Cloud & Container Platforms (Kubernetes / EKS)",
        "Computer Vision & Deep Learning Pipelines",
        "Enterprise Security & IAM (SAML 2.0 / OIDC)",
        "High-Frequency Fintech Trading Systems",
        "Logistics, Track & Trace"
      ],
      "yearsActive": 5,
      "philosophy": "Resilient systems prioritize clear service boundaries, predictable failure modes, end-to-end telemetry, and rigorous security boundaries.",
      "specialisation": "Solutions Architecture, .NET Core, Go, Python, Kubernetes EKS, SAML 2.0 / OIDC, and multi-tenant AI tracking pipelines.",
      "leadership": "Technical leadership across multi-tenant SaaS, cross-functional squads, microservice standardization, and modern cloud migrations.",
      "industries": [
        "Enterprise SaaS",
        "Computer Vision & AI",
        "Securities & Fintech",
        "Retail AI Auditing"
      ]
    },
    "links": [
      {
        "label": "LinkedIn Profile",
        "url": "https://www.linkedin.com/in/noman-a-70604a175",
        "type": "contact"
      },
      {
        "label": "GitHub Profile",
        "url": "https://github.com/noman-ali",
        "type": "repository"
      },
      {
        "label": "Google Scholar",
        "url": "https://scholar.google.com/citations?user=SFLfK9oAAAAJ&hl=en",
        "type": "website"
      },
      {
        "label": "Direct Email",
        "url": "mailto:nomansoomro51@gmail.com",
        "type": "contact"
      }
    ]
  },
  "skills": [
    # ── 1. PROGRAMMING LANGUAGES (Pure Languages Only) ───────────────
    {
      "id": "sk-python",
      "slug": "python",
      "name": "Python",
      "category": "Programming Languages",
      "reading": "10/10",
      "writing": "9/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Code Reading: 10/10 · Code Writing: 9/10 | Type: Multi-Paradigm, Scripting, Scientific & AI Engineering",
      "summary": "Code reading: 10/10 · Code writing: 9/10 — core language for deep learning architectures, asynchronous web microservices, computer vision pipelines, and test suites.",
      "description": "Expert hands-on mastery in Python (Code reading: 10/10, Code writing: 9/10). Deep understanding of asynchronous event loops (asyncio, uvloop), memory-efficient tensor allocations in PyTorch, C-extension interfaces, type annotations (mypy, Pydantic), and modern packaging with uv.",
      "featured": True,
      "tags": ["Programming Language", "Language", "Python", "AsyncIO", "Deep Learning", "Pydantic", "uv"],
      "technologies": ["Python", "AsyncIO", "uv", "Pydantic", "PyTorch", "OpenCV"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-tracker-simulator", "proj-quant-rl-trading", "proj-need", "proj-resume-hr"]
    },
    {
      "id": "sk-csharp",
      "slug": "csharp",
      "name": "C#",
      "category": "Programming Languages",
      "reading": "10/10",
      "writing": "9.5/10",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Code Reading: 10/10 · Code Writing: 9.5/10 | Type: Object-Oriented, Strongly Typed, Systems & Enterprise",
      "summary": "Code reading: 10/10 · Code writing: 9.5/10 — type-safe, high-performance object-oriented programming for mission-critical trading engines and enterprise systems.",
      "description": "Deep expertise in modern C# (Code reading: 10/10, Code writing: 9.5/10) including pattern matching, LINQ, async/await concurrency, Span/Memory performance primitives, record types, and generics across high-throughput financial architectures.",
      "featured": True,
      "tags": ["Programming Language", "Language", "C#", "OOP", "Strongly Typed", "LINQ", "AsyncIO"],
      "technologies": ["C#", "LINQ", "Type Systems", "Object-Oriented Programming", "Async/Await"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-resume-hr"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"]
    },
    {
      "id": "sk-typescript",
      "slug": "typescript",
      "name": "TypeScript",
      "category": "Programming Languages",
      "reading": "9/10",
      "writing": "8/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Code Reading: 9/10 · Code Writing: 8/10 | Type: Statically Typed JavaScript Superset, Full-Stack",
      "summary": "Code reading: 9/10 · Code writing: 8/10 — strictly typed full-stack development, React component contracts, Next.js App Router integrations, and AST tooling.",
      "description": "Extensive experience designing type-safe architectures in TypeScript (Code reading: 9/10, Code writing: 8/10). Utilizing advanced generics, mapped types, strict compiler configurations, interface contracts, and full-stack Next.js and Node.js systems.",
      "featured": True,
      "tags": ["Programming Language", "Language", "TypeScript", "JavaScript", "Static Typing", "Node.js"],
      "technologies": ["TypeScript", "JavaScript", "Node.js", "Type Systems"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-tracker-simulator", "proj-lab"]
    },
    {
      "id": "sk-cpp",
      "slug": "cpp",
      "name": "C++",
      "category": "Programming Languages",
      "reading": "9/10",
      "writing": "7/10",
      "depth": "proficient",
      "firstUsed": "2018",
      "context": "Code Reading: 9/10 · Code Writing: 7/10 | Type: Systems Programming & Low-Level Architecture | Paradigms: RAII, Memory Management, STL",
      "summary": "Code reading: 9/10 · Code writing: 7/10 — systems programming, memory management, STL containers, pointers, RAII, and algorithmic problem solving.",
      "description": "Strong code reading (9/10) and solid code writing (7/10) competence in C++. Experienced with RAII memory lifecycle management, smart pointers, template metaprogramming, STL data structures, algorithmic problem solving (HackerRank C++ certified), and native performance optimization.",
      "featured": True,
      "tags": ["Programming Language", "Language", "C++", "Systems Programming", "RAII", "STL", "Memory Management"],
      "technologies": ["C++", "STL", "Memory Management", "Pointers", "Algorithms"],
      "relatedEducation": ["edu-bs"]
    },
    {
      "id": "sk-go",
      "slug": "golang",
      "name": "Go (Golang)",
      "category": "Programming Languages",
      "reading": "9/10",
      "writing": "6/10",
      "depth": "deep",
      "firstUsed": "2021",
      "context": "Code Reading: 9/10 · Code Writing: 6/10 | Type: Concurrent, Compiled, Systems & Cloud-Native",
      "summary": "Code reading: 9/10 · Code writing: 6/10 — goroutines, concurrency channels, gRPC APIs, low-overhead microservices, and network tooling.",
      "description": "Leveraged Go (Code reading: 9/10, Code writing: 6/10) for high-throughput stream ingestion, concurrent event handling, and cloud-native Kubernetes tooling where sub-millisecond execution is mandatory.",
      "featured": True,
      "tags": ["Programming Language", "Language", "Go", "Golang", "gRPC", "Concurrency", "Microservices"],
      "technologies": ["Go", "Golang", "gRPC", "Concurrency", "Microservices"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-dart",
      "slug": "dart",
      "name": "Dart",
      "category": "Programming Languages",
      "reading": "9/10",
      "writing": "7/10",
      "depth": "proficient",
      "firstUsed": "2020",
      "context": "Code Reading: 9/10 · Code Writing: 7/10 | Type: Client-Optimized Language, Object-Oriented, Sound Null Safety",
      "summary": "Code reading: 9/10 · Code writing: 7/10 — strongly typed, client-optimized OOP language with sound null safety, async streams, and AOT/JIT compilation.",
      "description": "Strong code reading (9/10) and code writing (7/10) proficiency in Dart. Experienced with sound null safety, streams, isolates for background concurrency, mixins, factory constructors, and reactive architectures for multi-platform applications.",
      "featured": True,
      "tags": ["Programming Language", "Language", "Dart", "OOP", "Null Safety", "Mobile"],
      "technologies": ["Dart", "Sound Null Safety", "Async Streams", "Isolates", "OOP"]
    },

    # ── 2. FRAMEWORKS ────────────────────────────────────────────────
    {
      "id": "sk-dotnet",
      "slug": "dotnet-core",
      "name": ".NET Core",
      "category": "Frameworks",
      "agentic": "10/10",
      "aiAssisted": "9.5/10",
      "independent": "9.5/10",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Agentic Development: 10/10 · AI-Assisted Development: 9.5/10 · Independent Development: 9.5/10 | Type: Enterprise Application Framework & Web Runtime",
      "summary": "Agentic: 10/10 · AI-Assisted: 9.5/10 · Independent: 9.5/10 — .NET Core (.NET 3.1, .NET 6, .NET 8), ASP.NET Core, enterprise backend services, microservices, clean architecture, CQRS, and EF Core.",
      "description": "Architecting high-concurrency microservices and enterprise web APIs using .NET Core (.NET 3.1 / .NET 6 / .NET 8) and ASP.NET Core (Agentic: 10/10, AI-Assisted: 9.5/10, Independent: 9.5/10). Implementing custom middleware, authentication handlers with OpenIddict, EF Core relational queries, and low-latency response caching.",
      "featured": True,
      "tags": ["Enterprise Framework", "Web Framework", ".NET Core", ".NET 3.1", ".NET 6", ".NET 8", "ASP.NET Core", "OpenIddict", "Entity Framework", "Microservices"],
      "technologies": [".NET Core", ".NET 3.1", ".NET 6", ".NET 8", "ASP.NET Core", "OpenIddict", "Entity Framework", "Kestrel"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-microservices-template", "proj-resume-hr"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"]
    },
    {
      "id": "sk-fastapi",
      "slug": "fastapi",
      "name": "FastAPI",
      "category": "Frameworks",
      "agentic": "10/10",
      "aiAssisted": "9.5/10",
      "independent": "9.5/10",
      "depth": "specialist",
      "firstUsed": "2022",
      "context": "Agentic Development: 10/10 · AI-Assisted Development: 9.5/10 · Independent Development: 9.5/10 | Type: High-Performance API Framework & ASGI Runtime",
      "summary": "Agentic: 10/10 · AI-Assisted: 9.5/10 · Independent: 9.5/10 — FastAPI, Uvicorn ASGI server, asynchronous background workers, Pydantic schemas, and streaming endpoints.",
      "description": "Engineered high-concurrency asynchronous REST APIs with FastAPI (Agentic: 10/10, AI-Assisted: 9.5/10, Independent: 9.5/10), implementing structured Pydantic schemas, streaming response endpoints (MJPEG), runtime session controls, and low-latency benchmark processing.",
      "featured": True,
      "tags": ["API Framework", "FastAPI", "Uvicorn", "REST APIs", "Python", "ASGI", "AsyncIO", "Pydantic"],
      "technologies": ["FastAPI", "Uvicorn", "REST APIs", "AsyncIO", "Pydantic"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-tracker-simulator"]
    },
    {
      "id": "sk-fiber",
      "slug": "fiber-golang",
      "name": "Fiber (Golang Framework)",
      "category": "Frameworks",
      "agentic": "9/10",
      "aiAssisted": "7/10",
      "independent": "5/10",
      "depth": "proficient",
      "firstUsed": "2022",
      "context": "Agentic Development: 9/10 · AI-Assisted Development: 7/10 · Independent Development: 5/10 | Type: Express-Inspired Web Framework on Fasthttp for Go",
      "summary": "Agentic: 9/10 · AI-Assisted: 7/10 · Independent: 5/10 — high-performance, low-memory Go web framework built on Fasthttp for low-latency APIs and microservices.",
      "description": "Building high-throughput microservices and REST APIs in Go using Fiber (Agentic: 9/10, AI-Assisted: 7/10, Independent: 5/10). Leveraging zero memory allocation routing, middleware chaining, WebSocket connections, and fast JSON encoding powered by Fasthttp.",
      "featured": True,
      "tags": ["Framework", "Web Framework", "Fiber", "Go", "Golang", "Fasthttp", "REST APIs", "Microservices"],
      "technologies": ["Fiber", "Go", "Fasthttp", "REST APIs", "Microservices"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-frontend-nextjs",
      "slug": "nextjs",
      "name": "Next.js",
      "category": "Frameworks",
      "agentic": "9/10",
      "aiAssisted": "8/10",
      "independent": "6/10",
      "depth": "deep",
      "firstUsed": "2021",
      "context": "Agentic Development: 9/10 · AI-Assisted Development: 8/10 · Independent Development: 6/10 | Type: React Production Framework & Full-Stack Web Architecture",
      "summary": "Agentic: 9/10 · AI-Assisted: 8/10 · Independent: 6/10 — Next.js App Router, React Server Components, server actions, dynamic routing, and frontend architecture.",
      "description": "Architecting high-performance web frontends and interactive analytics dashboards using Next.js and React (Agentic: 9/10, AI-Assisted: 8/10, Independent: 6/10). Utilizing App Router, React Server Components, client-side canvas crop selectors, and optimized production builds.",
      "featured": True,
      "tags": ["Frontend Framework", "UI Library", "Next.js", "React", "HTML/CSS", "npm", "Interactive Canvas"],
      "technologies": ["Next.js", "React", "TypeScript", "JavaScript", "HTML/CSS", "npm"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-tracker-simulator"]
    },
    {
      "id": "sk-mfe",
      "slug": "module-federations",
      "name": "Module Federations",
      "category": "Frameworks",
      "agentic": "9/10",
      "aiAssisted": "8/10",
      "independent": "6/10",
      "depth": "proficient",
      "firstUsed": "2023",
      "context": "Agentic Development: 9/10 · AI-Assisted Development: 8/10 · Independent Development: 6/10 | Type: Microfrontend Architecture & Webpack Module Federation",
      "summary": "Agentic: 9/10 · AI-Assisted: 8/10 · Independent: 6/10 — Module Federation, dynamic remotes, shared state orchestration, and isolated team frontends.",
      "description": "Architected decoupled frontend micro-applications using Webpack 5 Module Federation (Agentic: 9/10, AI-Assisted: 8/10, Independent: 6/10), dynamic remote runtime loading, shared state orchestration, and isolated autonomous squad deployments.",
      "featured": True,
      "tags": ["Microfrontends", "Module Federation", "Webpack", "React", "Architecture"],
      "relatedProducts": ["prod-verseye"]
    },
    {
      "id": "sk-flutter",
      "slug": "flutter",
      "name": "Flutter (BLoC & Cubit)",
      "category": "Frameworks",
      "agentic": "10/10",
      "aiAssisted": "9/10",
      "independent": "7/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Agentic Development: 10/10 · AI-Assisted Development: 9/10 · Independent Development: 7/10 | Type: Multi-Platform UI Framework & State Architecture",
      "summary": "Agentic: 10/10 · AI-Assisted: 9/10 · Independent: 7/10 — cross-platform UI framework, BLoC pattern, Cubit state management, clean architecture, and custom render trees.",
      "description": "Specialist expertise in Flutter with BLoC and Cubit state architecture (Agentic: 10/10, AI-Assisted: 9/10, Independent: 7/10). Designing reactive presentation layers, stream-driven state transitions, event-to-state transformations, repository patterns, custom animations, and native platform channels across iOS and Android.",
      "featured": True,
      "tags": ["Framework", "UI Framework", "Flutter", "BLoC", "Cubit", "State Management", "Mobile", "Cross-Platform"],
      "technologies": ["Flutter", "BLoC", "Cubit", "State Management", "Dart", "Cross-Platform"],
      "relatedProjects": ["proj-navirox"]
    },
    {
      "id": "sk-nodejs",
      "slug": "nodejs",
      "name": "Node.js",
      "category": "Frameworks",
      "agentic": "10/10",
      "aiAssisted": "9/10",
      "independent": "7/10",
      "depth": "proficient",
      "firstUsed": "2020",
      "context": "Agentic Development: 10/10 · AI-Assisted Development: 9/10 · Independent Development: 7/10 | Type: Server-Side JavaScript Runtime & Microservices",
      "summary": "Agentic: 10/10 · AI-Assisted: 9/10 · Independent: 7/10 — Server-side JavaScript runtime, event-driven concurrency, REST APIs, and asynchronous microservices.",
      "description": "Building backend microservices, real-time communication, and API services with Node.js (Agentic: 10/10, AI-Assisted: 9/10, Independent: 7/10). Utilizing event-driven concurrency, non-blocking I/O, and npm ecosystem packages.",
      "featured": True,
      "tags": ["JavaScript Runtime", "Node.js", "Backend", "Event-Driven", "REST APIs", "npm"],
      "technologies": ["Node.js", "JavaScript", "REST APIs", "npm"],
      "relatedExperience": ["exp-ktrade"]
    },

    # ── 3. AI & DEEP LEARNING FRAMEWORKS ─────────────────────────────
    {
      "id": "sk-pytorch-cuda",
      "slug": "pytorch",
      "name": "PyTorch",
      "category": "AI & Deep Learning Frameworks",
      "level": "9/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Level: 9/10 | Type: Deep Learning Framework & Tensor Acceleration | Ecosystem: Dynamic Computational Graphs, CUDA Kernels, TorchScript & PyTorch 2.x",
      "summary": "9/10 level — dynamic computational graphs, CUDA GPU tensor acceleration, autograd, custom loss functions, mixed-precision inference, and zero-shot model execution.",
      "description": "Expert hands-on mastery in PyTorch (9/10). Designing, training, and serving neural network models on CUDA-accelerated hardware. Implementing memory-efficient inference pipelines, autograd mechanics, custom dataset loaders, tensor batching, model quantization, and distributed training primitives.",
      "featured": True,
      "tags": ["Deep Learning Framework", "GPU Acceleration", "PyTorch", "CUDA", "Tensors", "Mixed Precision", "Neural Networks"],
      "technologies": ["PyTorch", "CUDA", "NVIDIA GPU", "Autograd", "Mixed Precision"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-need"]
    },
    {
      "id": "sk-tensorrt",
      "slug": "tensorrt",
      "name": "TensorRT",
      "category": "AI & Deep Learning Frameworks",
      "level": "7/10",
      "depth": "proficient",
      "firstUsed": "2022",
      "context": "Level: 7/10 | Type: High-Performance Deep Learning Inference SDK | Platform: NVIDIA GPUs, Engine Serialization & FP16/INT8 Quantization",
      "summary": "7/10 level — NVIDIA TensorRT inference optimization, FP16/INT8 precision calibration, serialized engine building, and GPU inference acceleration.",
      "description": "Proficient in NVIDIA TensorRT (7/10) for maximizing GPU throughput and minimizing latency. Converting PyTorch and ONNX models into optimized TensorRT execution engines, layer fusion, kernel auto-tuning, and FP16/INT8 quantization for real-time computer vision inference.",
      "featured": True,
      "tags": ["Deep Learning Inference", "TensorRT", "NVIDIA", "GPU Optimization", "Quantization", "Inference Acceleration"],
      "technologies": ["TensorRT", "CUDA", "NVIDIA GPU", "Model Optimization", "FP16/INT8"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-onnx",
      "slug": "onnx",
      "name": "ONNX",
      "category": "AI & Deep Learning Frameworks",
      "level": "7/10",
      "depth": "proficient",
      "firstUsed": "2022",
      "context": "Level: 7/10 | Type: Open Neural Network Exchange & Inference Runtime | Platform: Cross-Platform Execution, Graph Optimization & Hardware Execution Providers",
      "summary": "7/10 level — ONNX format conversion, cross-platform model interoperability, ONNX Runtime graph optimizations, and Execution Provider integration.",
      "description": "Hands-on experience with ONNX and ONNX Runtime (7/10). Exporting PyTorch computation graphs to standardized ONNX formats, verifying graph consistency, applying graph-level optimizations, and executing inference with CUDA and CPU Execution Providers across production runtimes.",
      "featured": True,
      "tags": ["Inference Runtime", "ONNX", "ONNX Runtime", "Model Export", "Graph Optimization", "Cross-Platform AI"],
      "technologies": ["ONNX", "ONNX Runtime", "Model Export", "Cross-Platform Inference"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-jax",
      "slug": "jax",
      "name": "JAX",
      "category": "AI & Deep Learning Frameworks",
      "level": "7/10",
      "depth": "proficient",
      "firstUsed": "2023",
      "context": "Level: 7/10 | Type: High-Performance Numerical Computing & ML Framework | Paradigm: Composable Function Transformations, Autograd & XLA Compilation",
      "summary": "7/10 level — composable function transformations (grad, jit, vmap), XLA GPU compilation, functional pure-state ML modeling, and numerical research.",
      "description": "Competent experience in Google JAX (7/10). Utilizing functional transformations including automatic differentiation (grad), just-in-time compilation to XLA (jit), and vectorization batching (vmap) for accelerated research simulations and numerical computing.",
      "featured": True,
      "tags": ["Machine Learning Framework", "JAX", "Google JAX", "XLA", "Autograd", "Functional Programming", "Numerical Computing"],
      "technologies": ["JAX", "XLA", "Functional ML", "Autograd", "Vectorization"],
      "relatedProjects": ["proj-need"]
    },
    {
      "id": "sk-litert",
      "slug": "litert",
      "name": "LiteRT",
      "category": "AI & Deep Learning Frameworks",
      "level": "7/10",
      "depth": "proficient",
      "firstUsed": "2023",
      "context": "Level: 7/10 | Type: On-Device Lightweight Inference Runtime (formerly TFLite) | Target: Edge Devices, Mobile, Embedded & CPU/NPU Acceleration",
      "summary": "7/10 level — Google LiteRT (formerly TensorFlow Lite) on-device runtime, post-training quantization, flatbuffer model deployment, and edge execution.",
      "description": "Hands-on experience with LiteRT (7/10), Google's next-generation lightweight on-device AI runtime (formerly TensorFlow Lite). Deploying low-latency quantized vision models onto edge hardware, configuring delegates (NNAPI, GPU, XNNPACK), and optimizing memory footprint for constrained environments.",
      "featured": True,
      "tags": ["Edge AI", "LiteRT", "TFLite", "On-Device Inference", "Model Quantization", "Mobile AI", "Embedded AI"],
      "technologies": ["LiteRT", "TensorFlow Lite", "On-Device Inference", "Edge AI", "Quantization"]
    },
    {
      "id": "sk-tensorflow",
      "slug": "tensorflow",
      "name": "TensorFlow",
      "category": "AI & Deep Learning Frameworks",
      "level": "5/10",
      "depth": "working",
      "firstUsed": "2020",
      "context": "Level: 5/10 | Type: Machine Learning & Deep Learning Ecosystem | Paradigm: Keras High-Level APIs, SavedModel Formats & Graph Execution",
      "summary": "5/10 level — foundational TensorFlow / Keras layer architectures, SavedModel serialization, dataset pipelines, and legacy model migration.",
      "description": "Working foundational knowledge in TensorFlow (5/10). Experience building baseline feedforward and convolutional models with tf.keras, manipulating tf.data input pipelines, serializing models via SavedModel format, and migrating legacy architectures to modern PyTorch/ONNX pipelines.",
      "featured": True,
      "tags": ["Deep Learning Framework", "TensorFlow", "Keras", "Machine Learning", "Neural Networks"],
      "technologies": ["TensorFlow", "Keras", "SavedModel", "tf.data"]
    },
    {
      "id": "sk-evotorch",
      "slug": "evotorch",
      "name": "EvoTorch",
      "category": "AI & Deep Learning Frameworks",
      "depth": "specialist",
      "firstUsed": "2024",
      "context": "Type: Evolutionary Computation Library | Platform: PyTorch-Accelerated Neuroevolution & Population Search",
      "summary": "PyTorch-accelerated evolutionary computation, GPU-accelerated population rollouts, and gradient-free policy optimization.",
      "description": "Specialist experience utilizing EvoTorch for evolutionary computing and reinforcement learning. Leveraging GPU acceleration to parallelize population-based fitness evaluations, evolutionary strategies (ES), genetic algorithms, and gradient-free neural policy optimization.",
      "featured": True,
      "tags": ["Neuroevolution", "Evolutionary Algorithms", "EvoTorch", "PyTorch", "Genetic Algorithms", "Reinforcement Learning"],
      "technologies": ["EvoTorch", "PyTorch", "Genetic Algorithms", "Evolution Strategies", "Reinforcement Learning"],
      "relatedProjects": ["proj-need"]
    },
    {
      "id": "sk-ray",
      "slug": "ray",
      "name": "Ray (Distributed Computing)",
      "category": "AI & Deep Learning Frameworks",
      "depth": "proficient",
      "firstUsed": "2024",
      "context": "Type: Distributed Python Compute Framework | Ecosystem: Actor-Based Concurrency, Parallel Rollouts & Workload Scaling",
      "summary": "Distributed Python compute framework, actor-based concurrent rollouts, distributed population evaluations, and parallel task scaling.",
      "description": "Hands-on experience with Ray for distributed compute and parallel execution. Leveraging Ray actors, object stores, and parallelized worker pools to scale agent environment rollouts and concurrent fitness evaluations across multi-core CPU and GPU clusters.",
      "featured": True,
      "tags": ["Distributed Computing", "Ray", "Python", "Actor Model", "Parallel Processing", "Machine Learning Scaling"],
      "technologies": ["Ray", "Python", "Parallel Computing", "Distributed Execution"],
      "relatedProjects": ["proj-need"]
    },
    {
      "id": "sk-langchain",
      "slug": "langchain",
      "name": "LangChain & Agentic LLMs",
      "category": "AI & Deep Learning Frameworks",
      "depth": "specialist",
      "firstUsed": "2023",
      "context": "Type: Agentic LLM Orchestration & Tool Use | Ecosystem: LangChain, Multi-Agent Workflows, Document Parsers & Prompt Engineering",
      "summary": "Agentic LLM application development, multi-agent chains, dynamic tool invocation, document loaders, and semantic reasoning workflows.",
      "description": "Specialist experience orchestrating complex LLM-driven workflows and multi-agent systems using LangChain and modern agentic frameworks. Building autonomous pipelines for bulk unstructured document parsing, prompt templates, structured output parsing, dynamic tool binding, and multi-step reasoning agents.",
      "featured": True,
      "tags": ["LangChain", "LLMs", "Agentic AI", "AI Agents", "Prompt Engineering", "Python", "Tool Use"],
      "technologies": ["LangChain", "LLMs", "Agentic AI", "Prompt Engineering", "Python", "Structured Output Parsing"],
      "relatedProjects": ["proj-resume-hr"]
    },
    {
      "id": "sk-rag",
      "slug": "rag",
      "name": "Retrieval-Augmented Generation (RAG)",
      "category": "AI & Deep Learning Frameworks",
      "depth": "specialist",
      "firstUsed": "2023",
      "context": "Type: Semantic Retrieval & Knowledge Distillation | Ecosystem: Vector Embeddings, Hybrid Search, Context Reranking & Model Distillation",
      "summary": "RAG architecture, vector search retrieval, hybrid keyword/semantic search, context window optimization, and knowledge distillation for domain-adapted LLMs.",
      "description": "Designing and deploying production Retrieval-Augmented Generation (RAG) pipelines and knowledge distillation techniques. Specializing in indexing high-volume unstructured corpora, embedding generation, dense vector retrieval, context compression, explainable relevance scoring, and distilling reasoning from large teacher models into cost-effective student models for fast domain inference.",
      "featured": True,
      "tags": ["RAG", "Knowledge Distillation", "Vector Search", "Embeddings", "Information Retrieval", "LLMs", "Semantic Search"],
      "technologies": ["RAG", "Knowledge Distillation", "Vector Search", "Embeddings", "Hybrid Search", "Cosine Similarity"],
      "relatedProjects": ["proj-resume-hr"]
    },

    # ── 3b. WORKFLOW & AGENT ORCHESTRATION ───────────────────────────
    {
      "id": "sk-temporal",
      "slug": "temporal-io",
      "name": "Temporal.io",
      "category": "Workflow & Agent Orchestration",
      "depth": "specialist",
      "firstUsed": "2025",
      "context": "Type: Durable Workflow Orchestration | Ecosystem: Temporal.io, Python SDK, Activity Workers, Workflow Retries & State Persistence",
      "summary": "Durable, fault-tolerant workflow orchestration for long-running ML pipelines, automated retraining loops, and distributed background processing.",
      "description": "Production experience with Temporal.io for building durable, fault-tolerant workflows across distributed systems. Applied in VERSEYE for orchestrating automated model retraining pipelines, genetic-algorithm-based ONNX pruning runs, and TensorRT calibration jobs — ensuring workflows survive crashes, retries, and partial failures without data loss. Leverages Temporal's activity, workflow, and worker model to decouple long-running AI pipeline stages and maintain audit trails across distributed compute.",
      "featured": True,
      "tags": ["Temporal.io", "Workflow Orchestration", "Durable Execution", "ML Pipelines", "Distributed Systems", "Python"],
      "technologies": ["Temporal.io", "Python SDK", "Activity Workers", "Workflow Retries", "State Persistence"],
      "relatedProducts": ["prod-verseye"]
    },
    {
      "id": "sk-semantic-kernel",
      "slug": "microsoft-semantic-kernel",
      "name": "Microsoft Semantic Kernel",
      "category": "Workflow & Agent Orchestration",
      "depth": "working",
      "firstUsed": "2024",
      "context": "Type: AI Orchestration SDK | Ecosystem: Microsoft Semantic Kernel, .NET / Python, Plugins, Planners & Native Function Calling",
      "summary": "AI orchestration SDK for composing LLM-powered agents, plugins, and planners within .NET and Python ecosystems.",
      "description": "Working knowledge of Microsoft Semantic Kernel for building AI-native applications that combine LLMs with business logic through a plugin architecture. Experience composing kernel functions, planners, and memory connectors to integrate large language models into .NET backends — enabling structured agent reasoning, retrieval-augmented pipelines, and function-calling workflows within enterprise C# / .NET Core services.",
      "featured": False,
      "tags": ["Semantic Kernel", "Microsoft", "AI SDK", "LLM Orchestration", ".NET", "Plugins", "Planners"],
      "technologies": ["Microsoft Semantic Kernel", ".NET", "Python", "Plugins", "Planners", "Memory Connectors"]
    },
    {
      "id": "sk-langgraph",
      "slug": "langgraph",
      "name": "LangGraph",
      "category": "Workflow & Agent Orchestration",
      "depth": "working",
      "firstUsed": "2024",
      "context": "Type: Stateful Agent Graph Framework | Ecosystem: LangGraph, LangChain, Python, Cyclic Graphs & Checkpointing",
      "summary": "Stateful, cyclic multi-agent graph orchestration for building resilient, branching AI agent pipelines with checkpointing.",
      "description": "Working experience with LangGraph for constructing stateful, cyclically-structured multi-agent workflows. Enables building agent pipelines with loops, conditional branching, and persistent state checkpointing — going beyond linear LangChain chains to support complex agentic reasoning patterns such as reflection agents, critic-reviewer loops, and tool-use with retry logic. Integrated within agentic AI platforms to coordinate multiple specialized LLM agents with shared memory and streaming execution graphs.",
      "featured": False,
      "tags": ["LangGraph", "Multi-Agent", "Stateful Agents", "Graph Execution", "LangChain", "Python", "Agentic AI"],
      "technologies": ["LangGraph", "LangChain", "Python", "Cyclic Graphs", "Checkpointing", "State Machines"],
      "relatedProjects": ["proj-resume-hr"]
    },

    # ── 4. DATABASES & STORAGE ───────────────────────────────────────
    {
      "id": "sk-postgres",
      "slug": "postgresql",
      "name": "SQL PostgreSQL",
      "category": "Databases & Storage",
      "design": "10/10",
      "support": "10/10",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Design: 10/10 · Support: 10/10 | Type: Relational Database Management System (RDBMS)",
      "summary": "Design: 10/10 · Support: 10/10 — relational schema architecture, normalized design, complex query optimization, partitioning, and 24/7 mission-critical operational support.",
      "description": "Expert mastery in SQL and PostgreSQL across architecture, schema design, and production support (Design: 10/10, Support: 10/10). Designing relational schemas, index tuning (B-Tree, GIN, GiST, BRIN), EXPLAIN ANALYZE query plan optimization, connection pooling with PgBouncer, vacuum tuning, table partitioning, backup/replication, and ACID transaction isolation for high-volume financial and enterprise systems.",
      "featured": True,
      "tags": ["Relational Database", "SQL", "PostgreSQL", "Schema Design", "Partitioning", "Indexing", "ACID", "Database Administration"],
      "technologies": ["PostgreSQL", "SQL", "Query Optimization", "PgBouncer", "Partitioning"],
      "relatedProjects": ["proj-quant-rl-trading"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"]
    },
    {
      "id": "sk-redis",
      "slug": "redis",
      "name": "Redis (NoSQL Key-Value)",
      "category": "Databases & Storage",
      "design": "10/10",
      "support": "10/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Design: 10/10 · Support: 10/10 | Type: NoSQL In-Memory Key-Value Data Store & Cache",
      "summary": "Design: 10/10 · Support: 10/10 — in-memory key-value data structure design, cache topology, sub-millisecond retrieval, cluster support, and high-throughput operational maintenance.",
      "description": "Mastery in NoSQL key-value architecture with Redis across system design and production operational support (Design: 10/10, Support: 10/10). Architecting distributed in-memory cache layers, key eviction policies, Redis Cluster replication, pub/sub event streams, sorted sets for priority queues, sentinel failover, and operational monitoring under heavy transactional loads.",
      "featured": True,
      "tags": ["NoSQL Database", "Key-Value Store", "Redis", "Distributed Caching", "PubSub", "Sorted Sets", "Low Latency"],
      "technologies": ["Redis", "NoSQL", "Key-Value", "In-Memory Caching", "Pub/Sub", "Data Structures", "Redis Cluster"],
      "relatedProjects": ["proj-quant-rl-trading"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"]
    },
    {
      "id": "sk-mongodb",
      "slug": "mongodb",
      "name": "MongoDB (NoSQL Document-Based)",
      "category": "Databases & Storage",
      "design": "9/10",
      "support": "8/10",
      "depth": "deep",
      "firstUsed": "2020",
      "context": "Design: 9/10 · Support: 8/10 | Type: NoSQL Document-Oriented Database",
      "summary": "Design: 9/10 · Support: 8/10 — flexible BSON document schema design, aggregation pipelines, compound indexing, and replica set operational support.",
      "description": "Proficiency in NoSQL document database engineering with MongoDB (Design: 9/10, Support: 8/10). Structuring flexible JSON/BSON document schemas, embedding vs referencing tradeoffs, multi-stage aggregation framework pipelines, compound and geospatial indexing, replica set configurations, and cluster support.",
      "featured": True,
      "tags": ["NoSQL Database", "MongoDB", "Document Database", "Aggregation Pipeline", "BSON"],
      "technologies": ["MongoDB", "NoSQL", "Document Store", "Aggregation Framework"]
    },
    {
      "id": "sk-dynamodb",
      "slug": "dynamodb",
      "name": "DynamoDB",
      "category": "Databases & Storage",
      "level": "8/10",
      "depth": "deep",
      "firstUsed": "2021",
      "context": "Level: 8/10 | Type: Fully Managed NoSQL Database | Focus: Single-Table Architecture, Composite Partition/Sort Keys & Sub-10ms Latency",
      "summary": "8/10 level — Amazon DynamoDB single-table design, partition and sort key modeling, GSIs/LSIs, DynamoDB Streams, and auto-scaling throughput.",
      "description": "Strong proficiency (8/10) in Amazon DynamoDB. Designing efficient single-table access patterns, composite primary keys (PK/SK), Global Secondary Indexes (GSIs), TTL expiration, and event-driven architectures integrating DynamoDB Streams with AWS Lambda.",
      "featured": True,
      "tags": ["NoSQL Database", "DynamoDB", "AWS", "Single-Table Design", "Key-Value Store", "Serverless"],
      "technologies": ["Amazon DynamoDB", "NoSQL", "Single-Table Design", "DynamoDB Streams", "AWS"],
      "relatedExperience": ["exp-ktrade"]
    },
    {
      "id": "sk-memorydb",
      "slug": "aws-memorydb",
      "name": "AWS MemoryDB",
      "category": "Databases & Storage",
      "depth": "specialist",
      "firstUsed": "2021",
      "context": "Type: In-Memory Database Service | Engine: Redis-Compatible, Multi-AZ Transaction Log",
      "summary": "Amazon MemoryDB for Redis — ultra-fast in-memory performance with Multi-AZ durability and microsecond latency for trading and fintech workloads.",
      "description": "Hands-on experience with Amazon MemoryDB for Redis. Architecting ultra-fast, in-memory databases with durable transaction logs, Multi-AZ high availability, and sub-millisecond read/write performance for mission-critical fintech and trading states.",
      "featured": True,
      "tags": ["Database", "In-Memory", "AWS MemoryDB", "Redis", "AWS", "NoSQL", "Fintech", "Trading"],
      "technologies": ["AWS MemoryDB", "Redis", "AWS", "In-Memory Database"],
      "relatedExperience": ["exp-ktrade"]
    },
    {
      "id": "sk-timescaledb",
      "slug": "timescaledb",
      "name": "TimescaleDB",
      "category": "Databases & Storage",
      "design": "8/10",
      "support": "8/10",
      "depth": "specialist",
      "firstUsed": "2022",
      "context": "Design: 8/10 · Support: 8/10 | Type: Time-Series Database & SQL Engine | Focus: PostgreSQL Hypertables, Chunk Compression & Continuous Aggregates",
      "summary": "Design: 8/10 · Support: 8/10 — TimescaleDB hypertables, high-frequency tick compression, continuous aggregates, and low-latency market data downsampling.",
      "description": "Specialist proficiency in TimescaleDB for high-frequency financial and sensor time-series data (Design: 8/10, Support: 8/10). Designing partitioned hypertables, automated chunk compression policies, continuous aggregates for real-time OHLCV candlestick generation, and analytical window queries.",
      "featured": True,
      "tags": ["Time-Series Database", "TimescaleDB", "PostgreSQL", "Hypertables", "Compression", "Continuous Aggregates"],
      "technologies": ["TimescaleDB", "PostgreSQL", "Time-Series", "Hypertables", "Continuous Aggregates"],
      "relatedProjects": ["proj-quant-rl-trading"]
    },
    {
      "id": "sk-pgvector",
      "slug": "pgvector",
      "name": "pgvector",
      "category": "Databases & Storage",
      "design": "10/10",
      "support": "10/10",
      "depth": "specialist",
      "firstUsed": "2023",
      "context": "Design: 10/10 · Support: 10/10 | Type: Vector Similarity Search Extension for PostgreSQL | Focus: HNSW & IVFFlat Indexes, Dense Vector Search & RAG Memory",
      "summary": "Design: 10/10 · Support: 10/10 — high-dimensional vector similarity search in PostgreSQL, HNSW / IVFFlat indexing, cosine distance, and multimodal embedding retrieval.",
      "description": "Specialist proficiency in pgvector (Design: 10/10, Support: 10/10) for vector embeddings and similarity search inside PostgreSQL. Implementing HNSW and IVFFlat vector indexing, cosine/L2 distance calculations, hybrid search combining relational filters with dense embeddings, and RAG memory storage.",
      "featured": True,
      "tags": ["Vector Database", "pgvector", "PostgreSQL", "HNSW", "IVFFlat", "Vector Search", "Embeddings", "RAG"],
      "technologies": ["pgvector", "PostgreSQL", "Vector Search", "HNSW", "Cosine Distance", "Embeddings"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-qdrant",
      "slug": "qdrant",
      "name": "Qdrant",
      "category": "Databases & Storage",
      "design": "9/10",
      "support": "8/10",
      "depth": "deep",
      "firstUsed": "2023",
      "context": "Design: 9/10 · Support: 8/10 | Type: Dedicated Vector Search Engine & Database | Focus: Payload-based Filtering, Fast Approximate Nearest Neighbor (ANN) & Collection Management",
      "summary": "Design: 9/10 · Support: 8/10 — Qdrant vector database, payload-based metadata filtering, approximate nearest neighbor (ANN) search, and multimodal search engines.",
      "description": "Proficient in Qdrant (Design: 9/10, Support: 8/10) vector search engine. Structuring vector collections, configuring HNSW graph parameters, payload-based metadata filtering, snapshot management, and integrating high-throughput REST and gRPC search endpoints for multimodal AI applications.",
      "featured": True,
      "tags": ["Vector Database", "Qdrant", "Vector Search", "ANN", "HNSW", "Embeddings", "Multimodal AI"],
      "technologies": ["Qdrant", "Vector Search", "Payload Filtering", "ANN Search", "gRPC", "Embeddings"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },
    {
      "id": "sk-minio",
      "slug": "minio-sdk",
      "name": "MinIO SDK",
      "category": "Databases & Storage",
      "depth": "specialist",
      "firstUsed": "2023",
      "context": "Type: High-Performance Distributed S3-Compatible Object Storage | Architecture: Multi-Tenant Buckets, Evidence Streaming & Frame Archival",
      "summary": "Distributed S3-compatible object storage via MinIO SDK, frame and video evidence persistence, high-concurrency upload/download streaming, and bucket lifecycle policies.",
      "description": "Architecting distributed object storage with MinIO SDK across Python, Go, and .NET services. Managing high-throughput evidence persistence for computer vision platforms, storing frame snapshots, full-motion video segments, and detection metadata with deterministic S3-compatible bucket topologies.",
      "featured": True,
      "tags": ["Object Storage", "MinIO", "S3 Compatible", "Distributed Storage", "Video Archival", "Evidence Storage"],
      "technologies": ["MinIO", "MinIO SDK", "S3 API", "Object Storage", "Distributed Systems"],
      "relatedProducts": ["prod-verseye"]
    },

    # ── 6. MESSAGE BROKERS & EVENT HANDLERS ───────────────────────────
    {
      "id": "sk-aws-eventbridge",
      "slug": "aws-eventbridge-eventbus",
      "name": "AWS EventBridge (Event Bus)",
      "category": "Message Brokers & Event Handlers",
      "level": "8/10",
      "depth": "deep",
      "firstUsed": "2021",
      "context": "Level: 8/10 | Type: Serverless Event Bus & Event Router | Focus: Event Routing, Rule Matching & Microservice Decoupling (Ktrade Learn to Invest)",
      "summary": "8/10 level — serverless event routing, rule-based event pattern matching, schema registry, and asynchronous microservice integration (used in Ktrade Learn to Invest platform).",
      "description": "Proficient hands-on experience (8/10) with AWS EventBridge (Event Bus). Implemented event-driven asynchronous communication in Ktrade Securities (Learn to Invest backend), publishing trading league events, contest participation triggers, schema validation, and routing decoupled domain events to AWS Lambda workers and downstream microservices with dead-letter queue (DLQ) reliability.",
      "featured": True,
      "tags": ["Message Broker", "Event Bus", "AWS EventBridge", "Event-Driven", "Serverless", "AWS", "Microservices"],
      "technologies": ["AWS EventBridge", "Event Bus", "Serverless", "AWS Lambda", "Event Routing", "Microservices"],
      "relatedExperience": ["exp-ktrade"]
    },
    {
      "id": "sk-nats",
      "slug": "nats-messaging",
      "name": "NATS & JetStream",
      "category": "Message Brokers & Event Handlers",
      "proficiency": "5/5",
      "depth": "specialist",
      "firstUsed": "2021",
      "context": "Proficiency: 5/5 | Type: High-Performance Distributed Message System & Persistence Engine",
      "summary": "Proficiency: 5/5 — high-throughput, microsecond-latency messaging, NATS JetStream distributed persistence, subject-based routing, and cluster mesh.",
      "description": "Expert mastery in NATS and JetStream (Proficiency: 5/5). Architecting sub-millisecond distributed message fabrics across polyglot microservices (Go, Python, .NET). Leveraging NATS Core for high-frequency pub/sub, request-reply semantics, NATS JetStream for guaranteed at-least-once message persistence, deduplication, stream consumers, and decentralized multi-cluster leaf nodes.",
      "featured": True,
      "tags": ["Message Broker", "NATS", "JetStream", "Distributed Systems", "PubSub", "Low Latency", "Microservices"],
      "technologies": ["NATS", "NATS JetStream", "Pub/Sub", "Distributed Messaging", "Go"]
    },
    {
      "id": "sk-mqtt",
      "slug": "mqtt-protocol",
      "name": "MQTT",
      "category": "Message Brokers & Event Handlers",
      "proficiency": "4.5/5",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Proficiency: 4.5/5 | Type: Lightweight Publish/Subscribe Messaging Protocol",
      "summary": "Proficiency: 4.5/5 — lightweight edge publish/subscribe, hierarchical topic topologies, QoS guarantee negotiation (0/1/2), and real-time telemetry pipelines.",
      "description": "Deep proficiency in MQTT protocol and brokers (Proficiency: 4.5/5). Engineering low-overhead, high-concurrency event telemetry channels for edge devices, camera agents, and distributed microservices. Designing topic taxonomies, wildcard subscriptions, retained messages, Last Will and Testament (LWT) handlers, and fine-tuned QoS level delivery over constrained networks.",
      "featured": True,
      "tags": ["Message Broker", "MQTT", "PubSub", "IoT / Edge Telemetry", "Protocols", "QoS", "Low Latency"],
      "technologies": ["MQTT", "EMQX / Mosquitto", "Edge Telemetry", "Publish/Subscribe", "Protocols"],
      "relatedProjects": ["proj-navirox"]
    },
    {
      "id": "sk-kafka",
      "slug": "apache-kafka",
      "name": "Apache Kafka",
      "category": "Message Brokers & Event Handlers",
      "proficiency": "4.5/5",
      "depth": "deep",
      "firstUsed": "2021",
      "context": "Proficiency: 4.5/5 | Type: Distributed Event Streaming Platform",
      "summary": "Proficiency: 4.5/5 — distributed event streaming, partitioned topic commit logs, consumer group scalability, offset management, and fault-tolerant ingestion.",
      "description": "Strong proficiency in Apache Kafka (Proficiency: 4.5/5) for high-throughput event streaming and log aggregation. Designing partitioned topic architectures, key-based partitioning for ordering guarantees, consumer group scaling, consumer rebalance tuning, idempotent producers, and resilient stream ingestion pipelines.",
      "featured": True,
      "tags": ["Message Broker", "Event Streaming", "Apache Kafka", "Distributed Log", "Consumer Groups", "Stream Processing"],
      "technologies": ["Apache Kafka", "Event Streaming", "Topic Partitions", "Consumer Groups", "Distributed Systems"]
    },

    # ── 7. DEVOPS & CLOUD ────────────────────────────────────────────
    {
      "id": "sk-docker-compose",
      "slug": "docker-containerization",
      "name": "Docker Compose",
      "category": "DevOps & Cloud",
      "handling": "10/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Handling: 10/10 | Type: Containerization Platform & Multi-Service Orchestration",
      "summary": "Handling: 10/10 — multi-container developer environments, service topology, volume mounts, network bridging, and container lifecycle orchestration.",
      "description": "Expert hands-on mastery in Docker and Docker Compose (Handling: 10/10). Architecting reproducible multi-container topologies, multi-stage Dockerfiles for minimal production footprint, health checks, named volume persistence, isolated bridge networks, environment variable secret injection, and fast local development stacks.",
      "featured": True,
      "tags": ["Containerization Platform", "DevOps Tooling", "Docker", "Docker Compose", "uv", "npm", "Bash", "Containerization"],
      "technologies": ["Docker", "Docker Compose", "uv", "npm", "Bash"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-tracker-simulator"]
    },
    {
      "id": "sk-k8s",
      "slug": "kubernetes-eks",
      "name": "Kubernetes",
      "category": "DevOps & Cloud",
      "handling": "10/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Handling: 10/10 | Type: Container Orchestration Platform | Ecosystem: Kubernetes, Amazon EKS, Helm",
      "summary": "Handling: 10/10 — production Kubernetes cluster orchestration, Helm charts, Ingress routing, Horizontal Pod Autoscaling (HPA), and zero-downtime rolling deployments.",
      "description": "Expert hands-on mastery in Kubernetes (Handling: 10/10). Managing production container orchestration across AWS EKS and self-managed clusters. Structuring declarative YAML manifests, custom Helm charts, Ingress NGINX controllers, ConfigMaps/Secrets, resource quotas, HPA autoscaling policies, liveness/readiness probes, and automated zero-downtime GitOps rollouts.",
      "featured": True,
      "tags": ["Container Orchestration", "Cloud Platform", "Kubernetes", "Amazon EKS", "Docker", "Helm", "CI/CD", "AWS"],
      "technologies": ["Kubernetes", "Amazon EKS", "Docker", "Helm", "CI/CD", "AWS"],
      "relatedProjects": ["proj-zero-shots-trackers", "proj-microservices-template"],
      "relatedProducts": ["prod-verseye", "prod-klystr"]
    },
    {
      "id": "sk-docker-swarm",
      "slug": "docker-swarm",
      "name": "Docker Swarm",
      "category": "DevOps & Cloud",
      "handling": "9/10",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Handling: 9/10 | Type: Native Docker Cluster Management & Container Orchestration Engine",
      "summary": "Handling: 9/10 — Docker Swarm multi-node clustering, service discovery, overlay networking, rolling updates, and lightweight container orchestration.",
      "description": "Specialist proficiency in Docker Swarm (Handling: 9/10). Deploying and managing multi-node Swarm clusters with manager/worker nodes, declarative compose stack deployments, overlay networks for cross-host encrypted communication, ingress load balancing, rolling service updates with automated rollback, and high-availability topologies where lightweight orchestration is preferred over full Kubernetes overhead.",
      "featured": True,
      "tags": ["Container Orchestration", "Docker Swarm", "Clustering", "Docker", "DevOps", "Overlay Networks"],
      "technologies": ["Docker Swarm", "Docker", "Overlay Networks", "Container Clustering", "DevOps"]
    },
    {
      "id": "sk-git",
      "slug": "git-version-control-monorepo",
      "name": "Git, GitHub & Monorepo Architecture",
      "category": "DevOps & Cloud",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Type: Version Control System | Workflows: Git, GitHub, Monorepo Management",
      "summary": "Distributed version control, multi-project monorepo structures, branch policies, and GitOps automation.",
      "description": "Proficient in modern Git version control, maintaining multi-service and monorepo architectures, subproject isolation, code review workflows, semantic versioning, and CI/CD triggers.",
      "featured": False,
      "tags": ["Version Control System", "Developer Tooling", "Git", "GitHub", "Monorepo", "GitOps"],
      "technologies": ["Git", "GitHub", "Monorepo Architecture", "GitOps"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },

    # ── 7. STREAMING & MEDIA ─────────────────────────────────────────
    {
      "id": "sk-video-streaming",
      "slug": "ffmpeg-real-time-video-streaming",
      "name": "FFmpeg & Real-Time Video Streaming",
      "category": "Streaming & Media",
      "depth": "specialist",
      "firstUsed": "2021",
      "context": "Type: Multimedia Framework & Live Video Streaming Protocols | Pipelines: MJPEG, RTSP, RTMP",
      "summary": "FFmpeg media processing, MJPEG multipart streaming at 24+ FPS, RTSP/RTMP camera feeds, and video transcoding.",
      "description": "Architecting high-throughput media pipelines with FFmpeg and Python OpenCV VideoIO, multiplexing real-time video frames into low-latency multipart MJPEG HTTP streams consumable natively by web browsers, and ingesting live RTSP/RTMP surveillance cameras.",
      "featured": True,
      "tags": ["Multimedia Framework", "Streaming Protocol", "FFmpeg", "Real-Time Video Streaming", "MJPEG", "RTSP", "RTMP"],
      "technologies": ["FFmpeg", "Real-Time Video Streaming", "MJPEG", "RTSP", "OpenCV VideoIO"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },

    # ── 8. TESTING & QUALITY ─────────────────────────────────────────
    {
      "id": "sk-testing-pytest",
      "slug": "pytest-automated-testing",
      "name": "pytest & Automated Python Test Suites",
      "category": "Testing & Quality",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Type: Test Automation Framework | Practices: Unit Testing, Mocking, Regression Suites",
      "summary": "pytest fixtures, parameterized unit testing, mock backends, and automated regression suites.",
      "description": "Designing rigorous automated test suites using pytest, implementing parameterized fixtures, synthetic mock detectors (CPU-friendly test runs), API endpoint contract validation, and continuous integration checks.",
      "featured": False,
      "tags": ["Testing Framework", "Quality Assurance", "pytest", "Unit Testing", "Integration Testing", "Mocks"],
      "technologies": ["pytest", "Unit Testing", "Integration Testing", "Mock Fixtures"],
      "relatedProjects": ["proj-zero-shots-trackers"]
    },

    # ── 9. ARCHITECTURE ──────────────────────────────────────────────
    {
      "id": "sk-arch",
      "slug": "solutions-architecture",
      "name": "Distributed Systems & Solutions Architecture",
      "category": "Architecture",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Type: Systems Architecture & Domain Modeling | Design: Polyglot Microservices & Event Streams",
      "summary": "Polyglot microservices, event-driven pipelines, clean architecture, and high-concurrency systems.",
      "description": "Five years of experience designing fault-tolerant distributed platforms in Go, C#/.NET Core, and Python with decoupled event queues, strict domain boundaries, and multi-tenant isolation.",
      "featured": True,
      "tags": ["Microservices", "Event-Driven", "Distributed Systems", "Domain-Driven Design"]
    },
    {
      "id": "sk-microservices",
      "slug": "microservices",
      "name": "Microservices",
      "category": "Architecture",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Type: Distributed Systems Architecture | Focus: Domain Decomposition, Event-Driven Services & API Gateways",
      "summary": "Decoupled polyglot microservice architectures, domain boundaries, inter-service gRPC/messaging, and independent service lifecycles.",
      "description": "Architecting and engineering resilient, independently deployable microservices across Go, .NET Core, Python, and Node.js. Designing domain-driven bounded contexts, event-driven messaging topologies (NATS, AWS EventBridge), API gateways, gRPC/REST contracts, and containerized deployments on Kubernetes.",
      "featured": True,
      "tags": ["Microservices", "Architecture", "Distributed Systems", "Domain-Driven Design", "API Gateway"],
      "technologies": ["Microservices", "Docker", "Kubernetes", "gRPC", "REST APIs", "NATS"],
      "relatedProjects": ["proj-microservices-template"],
      "relatedProducts": ["prod-verseye", "prod-ktrade", "prod-ajeek"],
      "relatedExperience": ["exp-qbs", "exp-ktrade"]
    },
    {
      "id": "sk-async-processing",
      "slug": "async-processing",
      "name": "Async Processing",
      "category": "Architecture",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Type: Concurrency & Event Loops | Technologies: Python asyncio, Uvicorn, Non-blocking I/O",
      "summary": "High-concurrency asynchronous execution, event loops, non-blocking I/O, background task queues, and async stream processing.",
      "description": "Engineering asynchronous architectures for real-time computer vision and data pipelines. Leveraging Python asyncio, non-blocking coroutines, thread executors for CPU-bound tasks, concurrent task scheduling, and background job processing without blocking the main event loop.",
      "featured": True,
      "tags": ["Async Processing", "AsyncIO", "Concurrency", "Event Loop", "Non-blocking I/O", "Background Tasks"],
      "technologies": ["AsyncIO", "Python", "FastAPI", "Concurrency", "Event Loops"],
      "relatedProjects": ["proj-tracker-simulator"]
    },

    # ── 10. APIS & INTERFACES ────────────────────────────────────────
    {
      "id": "sk-rest-apis",
      "slug": "rest-apis",
      "name": "REST APIs",
      "category": "APIs & Interfaces",
      "depth": "specialist",
      "firstUsed": "2019",
      "context": "Type: API Design & Web Interfaces | Protocols: HTTP/HTTPS, OpenAPI / Swagger, JSON",
      "summary": "Designing robust, stateless RESTful APIs, OpenAPI/Swagger specifications, resource hierarchies, and versioned client contracts.",
      "description": "Architecting clean, scalable RESTful web APIs across Python (FastAPI), .NET Core, and Go. Deep expertise in HTTP semantics, status codes, content negotiation, pagination, idempotent operations, authentication middleware, and interactive OpenAPI documentation.",
      "featured": True,
      "tags": ["REST APIs", "REST", "API Design", "OpenAPI", "Swagger", "HTTP", "Web Architecture"],
      "technologies": ["REST APIs", "FastAPI", "OpenAPI", "JSON", "HTTP"],
      "relatedProjects": ["proj-tracker-simulator"],
      "relatedProducts": ["prod-learn-to-invest"]
    },
    {
      "id": "sk-grpc",
      "slug": "grpc",
      "name": "gRPC APIs",
      "category": "APIs & Interfaces",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Type: High-Performance RPC & Serialization | Protocols: gRPC, HTTP/2, Protocol Buffers",
      "summary": "High-performance inter-service RPCs, strongly-typed Protocol Buffer schemas, bi-directional streaming, and low-latency microservice communication.",
      "description": "Engineering high-throughput, low-latency microservice communication using gRPC and Protocol Buffers across Go and Python. Designing backward-compatible .proto schemas, code generation pipelines, unary and streaming RPCs, gRPC middleware/interceptors, and efficient multiplexing over HTTP/2.",
      "featured": True,
      "tags": ["gRPC", "gRPC APIs", "Protocol Buffers", "Protobuf", "RPC", "HTTP/2", "Microservices", "API Design"],
      "technologies": ["gRPC", "Protocol Buffers", "Protobuf", "HTTP/2", "Go", "Python"],
      "relatedProducts": ["prod-verseye", "prod-klystr"],
      "relatedExperience": ["exp-qbs"]
    },
    {
      "id": "sk-ocelot",
      "slug": "ocelot-api-gateway",
      "name": "Ocelot API Gateway (.NET)",
      "category": "APIs & Interfaces",
      "depth": "specialist",
      "firstUsed": "2020",
      "context": "Type: .NET Microservices API Gateway | Capabilities: Request Routing, Aggregation, Rate Limiting, Authentication & Middleware",
      "summary": "High-performance .NET API Gateway, downstream request routing, response aggregation, rate limiting, and JWT/claims authentication.",
      "description": "Specialist experience architecting and operating Ocelot API Gateway within .NET Core / ASP.NET Core microservices ecosystems. Implementing centralized reverse proxy routing, multi-service response aggregation, authentication and authorization delegation (OpenIddict, JWT), rate limiting, quality-of-service policies, header transformations, and load balancing across downstream microservice clusters.",
      "featured": True,
      "tags": ["API Gateway", "Ocelot", ".NET", ".NET Core", "ASP.NET Core", "Microservices", "Reverse Proxy", "Routing", "Rate Limiting"],
      "technologies": ["Ocelot", ".NET Core", "ASP.NET Core", "API Gateway", "Reverse Proxy", "Microservices", "JWT"],
      "relatedSkills": ["sk-dotnet", "sk-csharp", "sk-microservices", "sk-rest-apis"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"],
      "relatedProducts": ["prod-ktrade"],
      "relatedProjects": ["proj-microservices-template"]
    },
    {
      "id": "sk-aws-api-gateway",
      "slug": "aws-api-gateway",
      "name": "AWS API Gateway",
      "category": "APIs & Interfaces",
      "depth": "proficient",
      "firstUsed": "2021",
      "context": "Type: Managed Cloud API Gateway | Capabilities: REST & WebSocket APIs, Lambda Integration, API Keys, Throttling & Usage Plans",
      "summary": "Managed cloud API management, RESTful and HTTP API gateway endpoints, AWS Lambda proxy integrations, usage plans, and rate throttling.",
      "description": "Hands-on experience deploying and operating managed AWS API Gateways for enterprise and fintech backends. Configuring REST and HTTP API endpoints, integrating with AWS Lambda compute and VPC private links, defining OpenAPI stage deployments, request/response transformations, custom authorizers, Cognito/IAM access controls, usage plans, and traffic throttling.",
      "featured": True,
      "tags": ["AWS API Gateway", "API Gateway", "AWS", "Serverless", "REST APIs", "Cloud", "Lambda", "Microservices"],
      "technologies": ["AWS API Gateway", "AWS Lambda", "REST APIs", "AWS", "Serverless", "API Management", "Throttling"],
      "relatedSkills": ["sk-rest-apis", "sk-aws-eventbridge", "sk-microservices"],
      "relatedExperience": ["exp-ktrade"],
      "relatedProducts": ["prod-learn-to-invest"]
    },

    # ── 11. SECURITY ─────────────────────────────────────────────────
    {
      "id": "sk-iam",
      "slug": "iam-saml-oidc",
      "name": "IAM & Enterprise Security (SAML 2.0 / OIDC)",
      "category": "Security",
      "depth": "specialist",
      "firstUsed": "2022",
      "context": "Type: Enterprise Security & Federation | Protocols: SAML 2.0, OpenID Connect, OAuth 2.0",
      "summary": "SAML 2.0 IdP/SP federation, OpenID Connect, OAuth2, X.509 signatures, and enterprise SSO.",
      "description": "Architected centralized single sign-on federation engines integrating corporate identity directories, SAML protocol assertions, token issuance, and multi-factor authentication.",
      "featured": True,
      "tags": ["SAML 2.0", "OIDC", "OAuth2", "Identity", "SSO", "OpenIddict"]
    },

    # ── 12. LEADERSHIP & SOFT SKILLS ─────────────────────────────────
    {
      "id": "sk-leadership",
      "slug": "engineering-team-leadership",
      "name": "Engineering Leadership & Team Direction",
      "category": "Leadership & Soft Skills",
      "depth": "specialist",
      "firstUsed": "2021",
      "context": "Type: Soft Skill & Leadership | Competencies: Technical Direction, Team Leadership, Sprint Delivery, Mentorship, Cross-Functional Alignment",
      "summary": "Engineering squad leadership, team mentorship, microservices architecture governance, cross-functional collaboration, and technical hiring.",
      "description": "Demonstrated technical leadership leading development squads at Ktrade Securities (Ktrade Saudi microservices platform, Learn to Invest JazzCash integration) and QBS Co. (VERSEYE AI Platform, AJEEK & LOCKKEYZ). Guiding architectural decisions, mentoring senior and mid-level engineers, aligning business stakeholders with technical deliverables, and ensuring robust code quality through peer review standards.",
      "featured": True,
      "tags": ["Soft Skill", "Engineering Leadership", "Team Leadership", "Mentorship", "Agile Execution", "Architecture Governance"],
      "technologies": ["Engineering Leadership", "Team Mentorship", "Agile / Scrum", "Technical Architecture", "Code Review"],
      "relatedProducts": ["prod-verseye", "prod-ajeek", "prod-lockkeyz"],
      "relatedExperience": ["exp-ktrade", "exp-qbs"]
    }
  ],
  "experience": [
    {
      "id": "exp-qbs",
      "slug": "qbs-co-technical-lead",
      "name": "Technical Lead & Solutions Architect at QBS Co.",
      "organisation": "QBS Co.",
      "role": "Technical Lead & Solutions Architect",
      "employmentType": "Full-time",
      "location": "Karachi, Pakistan",
      "period": {
        "startDate": "2024-02-01",
        "ongoing": True
      },
      "impact": "Technical Lead and Solutions Architect across VERSEYE AI orchestration platform, AJEEK maintenance platform, and LOCKKEYZ IAM, cutting service kickoff boilerplate by 70-80%.",
      "summary": "Directing architecture, core platform engineering, and cloud modernization across enterprise computer vision, federated identity, and microservices.",
      "description": "Overseeing system architecture and engineering execution across multiple client and internal products. Spearheaded modernization from legacy IIS architectures to resilient Amazon EKS clusters and established scalable polyglot microservice templates in Go and .NET Core.",
      "responsibilities": [
        "Serving as Technical Lead for VERSEYE, architecting an AI app orchestration platform chaining distributed CV pipelines with .NET/kubectl dynamic plugin deployment.",
        "Serving as Technical Lead for AJEEK, architecting its microservices maintenance tracking platform, B2B/B2C modules, and SAP ERP integration.",
        "Architecting multi-tenant computer vision and identity platform backends in Go, C#, and Python.",
        "Guiding infrastructure evolution onto Amazon EKS with automated CI/CD and observability.",
        "Mentoring senior and mid-level software engineers across clean architecture and domain-driven design.",
        "Governing security compliance and enterprise SAML 2.0 / OIDC federation integrations."
      ],
      "achievements": [
        "Architected VERSEYE from scratch as Technical Lead, leading a cross-functional team across CV, AI/ML, backend, frontend, DevOps, and analytics to deliver multi-camera tracking (ByteTrack, BoT-SORT), natural text search, MinIO distributed evidence storage, and Webpack Module Federation micro-frontends.",
        "Delivered LOCKKEYZ enterprise IAM provider with SAP IAS, Azure AD, and FortiGate federation.",
        "Standardized company-wide microservices boilerplate reducing new project kickoff overhead by 70-80%.",
        "Migrated legacy IIS workloads to containerized Amazon EKS with auto-scaling and zero downtime.",
        "Awarded Best Track Lead - QBs co (2024–2025) for high-impact technical leadership and delivery excellence."
      ],
      "systems": ["VERSEYE AI Platform", "NAVIROX Unmanned Vessels CV & LiDAR Fusion", "Amazon EKS", "AJEEK Maintenance Platform", "LOCKKEYZ IAM", "BLUE Logistics Platform", "ResumeHR Agentic Platform", "Temporal.io Workflows"],
      "technologies": ["Kubernetes", "Amazon EKS", ".NET Core", "Go", "Python", "C++", "OpenIddict", "Temporal.io", "React", "Docker", "MinIO SDK", "FastAPI", "PyTorch", "TensorRT", "ONNX", "gRPC", "LiDAR", "MQTT", "Jetson", "Ocelot API Gateway"],
      "relatedSkills": ["sk-leadership", "sk-k8s", "sk-arch", "sk-microservices", "sk-csharp", "sk-dotnet", "sk-go", "sk-python", "sk-cpp", "sk-fastapi", "sk-pytorch-cuda", "sk-tensorrt", "sk-onnx", "sk-mfe", "sk-grpc", "sk-minio", "sk-mqtt", "sk-flutter", "sk-ocelot"],
      "relatedProducts": ["prod-verseye", "prod-lockkeyz", "prod-ajeek", "prod-blue"],
      "relatedProjects": ["proj-navirox", "proj-microservices-template", "proj-payment-middleware", "proj-resume-hr"],
      "featured": True
    },
    {
      "id": "exp-botonetics",
      "slug": "botonetics-deep-learning-engineer",
      "name": "Deep Learning Engineer at Botonetics",
      "organisation": "Botonetics",
      "role": "Deep Learning Engineer",
      "employmentType": "Part-time",
      "location": "Karachi, Pakistan",
      "period": {
        "startDate": "2023-10-01",
        "endDate": "2025-01-01",
        "ongoing": False
      },
      "impact": "Engineered agentic retail audit pipeline achieving 90%+ compliance accuracy across low-light and angled captures.",
      "summary": "Designed multimodal agentic computer vision pipelines for automated retail audit and planogram compliance.",
      "description": "Researched and built multimodal computer vision workflows integrating YOLO object detection, optical character recognition (OCR), and CLIP embedding retrieval to audit FMCG shelf arrangements automatically.",
      "responsibilities": [
        "Developing deep learning inference workflows for product identification and shelf placement validation.",
        "Implementing image preprocessing pipelines to compensate for adverse camera angles and poor lighting."
      ],
      "achievements": [
        "Engineered agentic retail audit pipeline with 90%+ planogram compliance accuracy.",
        "Reduced manual supermarket shelf auditing overhead through automated visual verification."
      ],
      "systems": ["Retail Planogram Audit Pipeline"],
      "technologies": ["Python", "PyTorch", "YOLO", "CLIP", "OpenCV"],
      "relatedProducts": [],
      "relatedProjects": [],
      "featured": True
    },
    {
      "id": "exp-ktrade",
      "slug": "ktrade-senior-software-developer",
      "name": "Senior Software Developer at Ktrade Securities",
      "organisation": "Ktrade Securities",
      "role": "Senior Software Developer",
      "employmentType": "Full-time",
      "location": "Karachi, Pakistan",
      "period": {
        "startDate": "2021-08-01",
        "endDate": "2023-10-01",
        "ongoing": False
      },
      "impact": "Led the Ktrade Saudi engineering team implementing the platform from scratch in microservices, and engineered the complete Learn to Invest backend integrated with JazzCash for national trading leagues and competitions.",
      "summary": "Led development of Ktrade Saudi microservices from inception, and engineered the overall backend for Learn to Invest integrated with the JazzCash app for national trading leagues and competitions.",
      "description": "Served as Senior Software Developer and Engineering Team Lead at Ktrade Securities. Led the engineering team to architect and build the Ktrade Saudi trading platform from scratch using modern microservices. Designed and developed the comprehensive backend for Learn to Invest (L2I), powering virtual trading leagues and gamified financial competitions, and engineered a high-volume integration gateway with the JazzCash mobile application enabling millions of users to participate in nationwide investment tournaments.",
      "responsibilities": [
        "Leading and mentoring the engineering team to design and build Ktrade Saudi from scratch using scalable microservices architecture.",
        "Architecting and developing the complete backend for the Learn to Invest platform, handling user onboarding, portfolio tracking, and real-time league scoring.",
        "Engineering the end-to-end integration gateway with the JazzCash mobile app, allowing millions of JazzCash users to seamlessly join trading leagues and competitions.",
        "Structuring distributed event processing, low-latency API contracts, and high-concurrency transaction handling for market simulations."
      ],
      "achievements": [
        "Delivered Ktrade Saudi from scratch as an event-driven microservices architecture, leading cross-functional engineering squads from conception to production.",
        "Architected and launched the Learn to Invest platform backend, powering high-engagement virtual trading leagues and interactive competitions.",
        "Successfully integrated Learn to Invest with JazzCash, facilitating seamless national participation in financial investment tournaments.",
        "Honored with official service verification from KASB / Ktrade Securities acknowledging distinguished engineering leadership and delivery."
      ],
      "systems": [
        "Learn to Invest Backend Platform (AWS EventBridge Event Bus)",
        "JazzCash League & Competition Integration Gateway",
        "Ktrade Saudi Microservices Platform"
      ],
      "technologies": ["C#", "ASP.NET Core", "Microservices", "Redis", "PostgreSQL", "AWS EventBridge", "AWS Lambda", "Ocelot API Gateway", "AWS API Gateway", "JazzCash API"],
      "relatedSkills": ["sk-leadership", "sk-csharp", "sk-dotnet", "sk-arch", "sk-microservices", "sk-redis", "sk-postgres", "sk-dynamodb", "sk-memorydb", "sk-aws-eventbridge", "sk-nats", "sk-k8s", "sk-nodejs", "sk-flutter", "sk-dart", "sk-ocelot", "sk-aws-api-gateway", "sk-rest-apis"],
      "relatedProducts": ["prod-learn-to-invest", "prod-ktrade"],
      "relatedProjects": ["proj-quant-rl-trading"],
      "links": [
        {
          "label": "Official Experience Letter (KASB / Ktrade Securities)",
          "url": "https://raw.githubusercontent.com/nomi181472/portfolio-os/refs/heads/main/media/kasb-exp.pdf",
          "type": "verification",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Official Experience Letter issued by KASB / Ktrade Securities",
          "note": "Verified tenure as Senior Software Developer (August 2021 – October 2023)",
          "links": [
            {
              "label": "View Experience Letter (PDF)",
              "url": "https://raw.githubusercontent.com/nomi181472/portfolio-os/refs/heads/main/media/kasb-exp.pdf",
              "type": "verification",
              "visibility": "public"
            }
          ]
        }
      ],
      "featured": True
    }
  ],
  "products": [
    {
      "id": "prod-verseye",
      "slug": "verseye",
      "name": "VERSEYE",
      "tagline": "AI-orchestration app reusing a single distributed CV pipeline to power multi-domain surveillance products",
      "category": "Computer Vision & AI Orchestration",
      "organisation": "QBS Co.",
      "period": {
        "startDate": "2025-11-01",
        "ongoing": True
      },
      "status": "live",
      "source": { "type": "closed-source" },
      "summary": "AI app market orchestration platform engineered from scratch as Technical Lead, reusing a single distributed computer vision pipeline to power surveillance domains (PPE compliance, footfall analytics, employee monitoring, restaurant monitoring, planogram compliance, quality inspection) with natural text search, connected evidence graphs, and runtime Kubernetes plugin deployment.",
      "description": "**VERSEYE** is an enterprise AI app market orchestration platform engineered from scratch at QBS Co., where Noman Ali serves as Technical Lead — directing a cross-functional team across computer vision, AI/ML, backend, frontend, DevOps, and analytics.\n\n**Platform Overview**\nThe core idea: one high-throughput computer vision pipeline, many domain-specific surveillance products. VERSEYE powers employee monitoring, restaurant monitoring, planogram compliance, PPE monitoring, footfall analytics, and industrial quality inspection — all from a single shared pipeline backbone with a distributed backend and micro-frontend UI.\n\n**Dynamic Plugin Runtime (.NET + Kubernetes)**\nPlugins are containerized AI modules deployed, scaled, and managed at runtime directly from the UI. Using .NET with native kubectl integration, operators can launch or retire detection models on live Kubernetes clusters with zero downtime — no DevOps ticket required.\n\n**Polyglot Pipeline Engine**\nThe core pipeline is Python-based (FastAPI + gRPC), but plugins can be written in any language — C++, Go, Python, or C# — as long as they expose a gRPC or REST interface. This enables teams to pick the best runtime per model: CUDA-optimized C++ for object detection, Go for high-throughput ingestion, Python for model experimentation.\n\n**Connected Evidence Graph & Natural Language Search**\nBecause every detection in the pipeline is linked: a natural language query like *\"give me all people who are using mobile\"* resolves through text → local track ID → global track ID → frame snapshots → timestamp-synchronized video clips, all stored across distributed MinIO object storage. No manual tagging. No keyword search. Pure semantic retrieval.\n\n**Multi-Camera Tracking & Global ReID**\nSupports ByteTrack, DeepSORT, OC-SORT, and BoT-SORT for multi-camera tracking with global re-identification across face, gait, pose, appearance, and text query signals — enabling continuous subject tracking across camera boundaries in large-scale deployments.\n\n**Micro-Frontend Shell (Webpack Module Federation)**\nEach surveillance domain (PPE, footfall, employee monitoring, etc.) is an independently built and deployed micro-frontend. Webpack Module Federation dynamically loads these remotes into a unified shell, allowing domain teams to ship UI updates without coordinating a monolith release.\n\n**Inference Optimization & Durable Retraining**\nModels are optimized end-to-end: ONNX export → genetic-algorithm-based graph pruning → TensorRT FP16/INT8 acceleration on NVIDIA GPUs. Temporal.io orchestrates durable retraining workflows, ensuring model lifecycle jobs survive hardware failures and are fully auditable.\n\nThe platform has been demonstrated in successful client demos and is under active production feature development.",
      "features": [
        {
          "name": "Natural Text & Semantic Video Search",
          "detail": "Pipeline chaining empowers open-vocabulary natural language queries (e.g., 'give me all people who are using mobile') mapped to visual detections and temporal video occurrences."
        },
        {
          "name": "Connected Evidence Graph & Video Retrieval",
          "detail": "Interconnected evidence structure where text queries, local track IDs, and global track IDs resolve to image frames, and each image immediately retrieves the synchronized video segment captured at that exact timestamp across distributed storage."
        },
        {
          "name": "Multi-Camera Tracking & Global Re-Identification",
          "detail": "Multi-camera tracking supporting ByteTrack, DeepSORT, OC-SORT, and BoT-SORT with cross-camera global re-identification across face, gait, pose, appearance, and text queries."
        },
        {
          "name": "Dynamic Kubernetes Plugin Runtime (.NET & kubectl)",
          "detail": "UI-driven orchestration layer using .NET with direct kubectl integration for dynamic runtime deployment, scaling, and lifecycle management of containerized model plugins on Kubernetes."
        },
        {
          "name": "Polyglot Plugin Microservices (Python, C++, Go)",
          "detail": "Core pipeline engine in Python with polyglot plugin interfaces, allowing detection and vision plugins to be implemented in C++, Go, or Python and exposed via gRPC and REST."
        },
        {
          "name": "Webpack Module Federation Micro-Frontends",
          "detail": "Micro-frontend architecture using Webpack Module Federation, enabling autonomous build, versioning, and runtime integration of domain-specific UIs into a single host shell."
        },
        {
          "name": "Multi-Domain Surveillance Solutions",
          "detail": "Single core vision pipeline re-used across PPE compliance, employee monitoring, footfall analytics, restaurant monitoring, planogram compliance, and quality inspection."
        },
        {
          "name": "Temporal.io Retraining & GA Model Pruning",
          "detail": "Durable Temporal.io workflows managing automated model retraining, genetic-algorithm-based pruning, ONNX graph optimization, and TensorRT GPU acceleration."
        }
      ],
      "architecture": {
        "summary": "Distributed AI orchestration and computer vision pipeline combining a .NET kubectl Kubernetes operator, Python/FastAPI CV engine, polyglot gRPC plugin runtime, MinIO distributed object storage, and a Webpack Module Federation micro-frontend shell.",
        "layers": [
          {
            "name": "Micro-Frontend Shell & Domain Remotes",
            "detail": "Webpack Module Federation host shell dynamically loading isolated per-plugin domain frontends (PPE, Footfall, Employee, Planogram, Quality).",
            "technologies": ["Webpack Module Federation", "React", "TypeScript"]
          },
          {
            "name": "Runtime Plugin Orchestration Layer",
            "detail": ".NET service managing dynamic container lifecycle, plugin registry, and automated scaling via kubectl commands on Kubernetes clusters.",
            "technologies": [".NET Core", "C#", "Kubectl", "Kubernetes", "Docker"]
          },
          {
            "name": "Core CV Pipeline & Multi-Camera Tracking Engine",
            "detail": "High-performance Python engine executing chained inference pipelines (ByteTrack, DeepSORT, OC-SORT, BoT-SORT), global ReID, and semantic text-to-visual search.",
            "technologies": ["Python", "FastAPI", "PyTorch", "ByteTrack", "BoT-SORT", "DeepSORT", "OC-SORT"]
          },
          {
            "name": "Polyglot Plugin Workloads",
            "detail": "Extensible detection and classification plugins written in C++, Go, or Python communicating with the core engine over gRPC and REST.",
            "technologies": ["C++", "Go", "Python", "gRPC", "REST APIs"]
          },
          {
            "name": "Inference Optimization & Durable Workflows",
            "detail": "Temporal.io orchestration for durable retraining pipelines, genetic algorithm model pruning, ONNX Runtime, and TensorRT GPU execution.",
            "technologies": ["Temporal.io", "TensorRT", "ONNX", "CUDA"]
          },
          {
            "name": "Distributed Storage & Connected Evidence Layer",
            "detail": "MinIO S3-compatible distributed object storage persisting indexed frame snapshots, timestamped video segments, and relational track metadata in PostgreSQL and Redis.",
            "technologies": ["MinIO SDK", "PostgreSQL", "Redis", "Distributed Storage"]
          }
        ]
      },
      "metrics": [
        { "label": "Role", "value": "Technical Lead (Built from scratch)" },
        { "label": "Tracking Engines", "value": "ByteTrack, DeepSORT, OC-SORT, BoT-SORT" },
        { "label": "Search Modalities", "value": "Natural Text, Global ReID, Face, Gait, Pose" },
        { "label": "Frontend Arch", "value": "Webpack Module Federation Micro-Frontends" },
        { "label": "Backend Arch", "value": "Polyglot Microservices (.NET, Python, Go, C++)" },
        { "label": "Storage & Workflows", "value": "MinIO SDK + Temporal.io + Kubernetes" }
      ],
      "media": [],
      "links": [],
      "technologies": [
        ".NET Core",
        "C#",
        "Python",
        "Go",
        "C++",
        "FastAPI",
        "PyTorch",
        "TensorRT",
        "ONNX",
        "gRPC",
        "REST APIs",
        "Kubernetes",
        "MinIO SDK",
        "Microservices",
        "Microfrontends",
        "Webpack Module Federation",
        "Temporal.io",
        "ByteTrack",
        "DeepSORT",
        "OC-SORT",
        "BoT-SORT"
      ],
      "tags": [
        "Computer Vision",
        "AI Orchestration",
        "Multi-Camera Tracking",
        "Global ReID",
        "Semantic Search",
        "Microservices",
        "Microfrontends",
        "Module Federation",
        "Kubernetes",
        "MinIO",
        "Temporal.io",
        "Technical Lead"
      ],
      "relatedExperience": ["exp-qbs"],
      "relatedSkills": [
        "sk-microservices",
        "sk-mfe",
        "sk-arch",
        "sk-python",
        "sk-csharp",
        "sk-dotnet",
        "sk-go",
        "sk-cpp",
        "sk-fastapi",
        "sk-pytorch-cuda",
        "sk-tensorrt",
        "sk-onnx",
        "sk-minio",
        "sk-grpc",
        "sk-rest-apis",
        "sk-k8s",
        "sk-leadership",
        "sk-video-streaming",
        "sk-async-processing"
      ],
      "featured": True
    },
    {
      "id": "prod-lockkeyz",
      "slug": "lockkeyz",
      "name": "LOCKKEYZ — Enterprise Identity Provider",
      "tagline": "Enterprise SAML 2.0 & OIDC identity federation and SSO platform",
      "category": "Enterprise Security & IAM",
      "organisation": "QBS Co.",
      "period": {
        "startDate": "2024-02-01",
        "ongoing": True
      },
      "summary": "Centralized identity federation and single sign-on platform bridging SAP IAS, Azure Active Directory, and FortiGate network gateways.",
      "description": "LOCKKEYZ is a centralized identity federation and single sign-on platform engineered with ASP.NET Core and OpenIddict. It enables secure enterprise federation between legacy SAP IAS systems, corporate Microsoft Azure Active Directory (Entra ID), and FortiGate enterprise VPN gateways.",
      "technologies": [".NET Core", "C#", "OpenIddict", "SAML 2.0", "Redis", "PostgreSQL"],
      "source": { "type": "closed-source" },
      "features": [
        { "name": "SAML 2.0 IdP & SP Federation", "detail": "Full support for XML assertions, X.509 cryptographic signing, and single logout." },
        { "name": "OpenID Connect & OAuth 2.0", "detail": "Token issuance, PKCE flows, and scoped API authorization." },
        { "name": "Enterprise Directory Sync", "detail": "Integrates SAP IAS, corporate Azure AD, and FortiGate network access controls." }
      ],
      "architecture": {
        "summary": "High-security identity engine built on ASP.NET Core with OpenIddict, Redis session stores, and encrypted database persistence.",
        "layers": [
          {
            "name": "Federation Protocol Gateway",
            "detail": "Validates SAML assertions and issues verified OIDC tokens.",
            "technologies": ["ASP.NET Core", "OpenIddict", "X.509"]
          },
          {
            "name": "User Directory & RBAC Engine",
            "detail": "Enforces MFA challenges, role bindings, and audit logging.",
            "technologies": ["PostgreSQL", "Redis", "Azure AD"]
          }
        ]
      },
      "metrics": [
        { "label": "Protocol Support", "value": "SAML 2.0 & OIDC" },
        { "label": "Integrations", "value": "SAP IAS, Azure AD, FortiGate" },
        { "label": "Security Standard", "value": "Enterprise SSO" }
      ],
      "relatedExperience": ["exp-qbs"],
      "featured": True
    },
    {
      "id": "prod-ajeek",
      "slug": "ajeek",
      "name": "AJEEK",
      "tagline": "Microservices maintenance tracking, service dispatch, and ERP integration platform",
      "category": "Maintenance & Operations",
      "organisation": "QBS Co.",
      "period": {
        "startDate": "2024-11-01",
        "endDate": "2025-03-31",
        "ongoing": False
      },
      "status": "live",
      "source": { "type": "closed-source" },
      "summary": "Microservices maintenance tracking platform by QBS Co. featuring B2B and B2C operational modules, ticket lifecycle monitoring, technician recommendations, item management, order placement, and SAP ERP integration.",
      "description": "AJEEK is a multi-service maintenance operations platform architected on microservices, built under the technical leadership of Noman Ali at QBS Co. The system manages the entire maintenance lifecycle across both B2B enterprise client contracts and B2C consumer requests. Features include real-time ticket creation and monitoring, an intelligent recommendation engine for field technicians, comprehensive spare parts and item management, in-platform order placements, and direct enterprise ERP integration with SAP.",
      "features": [
        {
          "name": "Overall Maintenance Tracking",
          "detail": "Multi-service tracking architecture delivering end-to-end operational visibility across all maintenance workflows."
        },
        {
          "name": "B2B & B2C Operational Modules",
          "detail": "Dual-module architecture serving enterprise business accounts (B2B) alongside direct consumer service requests (B2C)."
        },
        {
          "name": "Ticket Creation & Real-Time Monitoring",
          "detail": "Automated ticket logging, SLA tracking, status transitions, and runtime monitoring throughout the service lifecycle."
        },
        {
          "name": "Technician Recommendation Engine",
          "detail": "Intelligent matching and task recommendations dispatching qualified technicians based on ticket nature, skillset, and availability."
        },
        {
          "name": "Products & Item Management",
          "detail": "Centralized inventory catalog managing spare parts, equipment maintenance items, consumables, and stock tracking."
        },
        {
          "name": "SAP ERP Integration",
          "detail": "Seamless bidirectional enterprise integration with SAP ERP for asset data synchronization, procurement, and financial records."
        },
        {
          "name": "Order Placements",
          "detail": "Integrated ordering workflows for parts replacement, consumable supplies, and maintenance work orders."
        }
      ],
      "technologies": [
        "Microservices",
        "SAP ERP Integration",
        "B2B & B2C Architecture",
        "Ticket Management",
        "Technician Recommendation",
        "Item Management",
        "Order Placement",
        "REST APIs"
      ],
      "tags": [
        "Microservices",
        "Maintenance Tracking",
        "B2B",
        "B2C",
        "Technical Lead",
        "QBS Co.",
        "SAP ERP",
        "Ticket Monitoring",
        "Technician Recommendation",
        "Item Management",
        "Order Placement"
      ],
      "metrics": [
        { "label": "Role", "value": "Technical Lead" },
        { "label": "Architecture", "value": "Microservices" },
        { "label": "ERP Sync", "value": "SAP ERP Integration" },
        { "label": "Scope", "value": "B2B & B2C Modules" }
      ],
      "relatedSkills": [
        "sk-microservices",
        "sk-leadership",
        "sk-arch",
        "sk-rest-apis"
      ],
      "relatedProjects": ["proj-microservices-template"],
      "relatedExperience": ["exp-qbs"],
      "featured": True
    },
    {
      "id": "prod-klystr",
      "slug": "klystr",
      "name": "Klystr — Kubernetes Operations & Topology",
      "tagline": "See. Understand. Operate — visual Kubernetes resource topology, RBAC inspection, and cluster security in VS Code & the web.",
      "category": "Cloud & DevOps Tooling",
      "organisation": "Independent",
      "period": {
        "startDate": "2024-01-01",
        "ongoing": True
      },
      "summary": "Independent open-source developer and operations platform providing visual Kubernetes resource topology, RBAC security inspection, and manifest analysis.",
      "description": "Klystr is an independent open-source Kubernetes operations and cluster visualization platform engineered to demystify complex containerized architectures. It maps live cluster states into an interactive directed graph, audits RBAC permissions for privilege escalation vectors, and integrates directly into developer workflows through the Visual Studio Code Marketplace and an interactive topology canvas.",
      "status": "live",
      "source": {
        "type": "open-source",
        "url": "https://github.com/nomi181472/klystr",
        "license": "MIT",
        "note": "Independent Project"
      },
      "technologies": ["Go", "Kubernetes", "TypeScript", "React", "Docker", "VS Code Extension API"],
      "features": [
        { "name": "Interactive Resource Topology", "detail": "Live visual dependency graph mapping services, pods, deployments, and ingress routes in real time." },
        { "name": "RBAC Security & Privilege Inspection", "detail": "Analyzes RoleBindings, ClusterRoles, and ServiceAccounts to identify potential privilege escalation vectors." },
        { "name": "VS Code IDE Extension", "detail": "Available directly on the Visual Studio Code Marketplace for seamless in-editor cluster operations." },
        { "name": "Web Topology Workspace", "detail": "Browser-based operations portal for interactive cluster topology inspection." }
      ],
      "architecture": {
        "summary": "Lightweight client-side and cloud-native architecture combining Go cluster query tools with a high-performance interactive TypeScript/React graph visualization canvas.",
        "layers": [
          {
            "name": "Cluster API & Graph Ingestion Engine",
            "detail": "Inspects Kubernetes API server endpoints, queries cluster resources, and models object relationships.",
            "technologies": ["Go", "Kubernetes Client-go", "gRPC"]
          },
          {
            "name": "Topology Canvas & Visualization",
            "detail": "Interactive directed-graph canvas with live filtering by namespace, status, and health telemetry.",
            "technologies": ["TypeScript", "React", "HTML5 Canvas"]
          },
          {
            "name": "VS Code Marketplace Integration",
            "detail": "Native VS Code extension bridge allowing developers to run diagnostics without context switching.",
            "technologies": ["VS Code Extension API", "Node.js"]
          }
        ]
      },
      "metrics": [
        { "label": "License", "value": "Open Source (MIT)" },
        { "label": "Ecosystem", "value": "Web & VS Code" },
        { "label": "Target", "value": "Kubernetes Clusters" }
      ],
      "media": [
        {
          "type": "iframe",
          "url": "https://tools.klystr.botonetics.com/",
          "title": "Klystr Web Topology Workspace",
          "caption": "Live interactive Kubernetes operations, topology inspection, and manifest analysis platform."
        },
        {
          "type": "svg",
          "url": "/media/klystr-logo.svg",
          "title": "Klystr Brand Icon",
          "caption": "Official Klystr visual logo and brand mark."
        }
      ],
      "links": [
        {
          "label": "Live Web Platform",
          "url": "https://tools.klystr.botonetics.com/",
          "type": "website"
        },
        {
          "label": "VS Code Marketplace Extension",
          "url": "https://marketplace.visualstudio.com/items?itemName=klystr.klystr",
          "type": "download"
        },
        {
          "label": "GitHub Repository (Open Source)",
          "url": "https://github.com/nomi181472/klystr",
          "type": "repository"
        }
      ],
      "relatedExperience": [],
      "featured": True
    },
    {
      "id": "prod-blue",
      "slug": "blue",
      "name": "BLUE",
      "tagline": "Logistics, track & trace platform for closed-loop gas cylinder lifecycle and customer management",
      "category": "Logistics, Track & Trace",
      "organisation": "QBS Co.",
      "period": {
        "startDate": "2023-02-01",
        "endDate": "2023-08-01",
        "ongoing": False
      },
      "status": "live",
      "source": {
        "type": "closed-source",
        "note": "Commercial Platform"
      },
      "summary": "Logistics and track-and-trace platform developed at QBS Co. for gas cylinder lifecycle management, order placement, in-app payments, and closed-loop bottling-to-customer tracking.",
      "description": "BLUE is an enterprise logistics and track-and-trace platform developed at QBS Co., managing the complete closed-loop journey of cylinder units: from bottling unit to warehouse, warehouse to customer, customer back to warehouse, and return to bottling units. Operating in the logistics, track-and-trace domain, it enables tracking of gas levels and customer reuse, customer historical records and account management, in-app order placement, and mobile payments.",
      "features": [
        {
          "name": "Closed-Loop Cylinder Tracking",
          "detail": "Complete tracking of units from bottling unit to warehouse, warehouse to customer, customer to warehouse, and back to bottling units."
        },
        {
          "name": "Track & Trace Unit Monitoring",
          "detail": "Precise track-and-trace telemetry monitoring unit movement, custody handoffs, and lifecycle status."
        },
        {
          "name": "Gas Level & Reuse Tracking",
          "detail": "Track gas levels in cylinders and monitor cylinder reuse cycles from customers."
        },
        {
          "name": "Customer Records & App Management",
          "detail": "Comprehensive historical records of customers and centralized management via mobile application."
        },
        {
          "name": "In-App Order Placement",
          "detail": "Direct in-app order placement for gas cylinder deliveries and refills."
        },
        {
          "name": "In-App Payment Processing",
          "detail": "Seamless digital payment handling directly through the mobile application."
        }
      ],
      "technologies": [
        "Logistics",
        "Track & Trace",
        "Mobile App",
        "Order Placement",
        "In-App Payments",
        "Lifecycle Tracking",
        "Supply Chain Logistics"
      ],
      "tags": [
        "Logistics",
        "Track and Trace",
        "Track & Trace",
        "Supply Chain",
        "QBS Co.",
        "Cylinder Tracking",
        "Order Placement",
        "In-App Payments",
        "Customer Management",
        "Closed-Loop"
      ],
      "relatedSkills": [],
      "relatedExperience": ["exp-qbs"],
      "relatedProjects": ["proj-payment-middleware"],
      "featured": True
    },
    {
      "id": "prod-ktrade",
      "slug": "ktrade",
      "name": "Ktrade",
      "tagline": "Fintech and trading platform",
      "category": "Fintech & Trading",
      "organisation": "Ktrade",
      "period": {
        "startDate": "2022",
        "endDate": "2023",
        "ongoing": False
      },
      "status": "live",
      "source": { "type": "closed-source" },
      "summary": "Fintech and trading microservices platform by Ktrade featuring PSX live feeds, Saudi Tadawul integrations, historical data analytics, and financial LMS education on Ktrade Saudi.",
      "description": "Fintech and trading platform developed at Ktrade architected with microservices. Features PSX live feed integration, Saudi market Tadawul integration, and a dedicated microservices version for Ktrade Saudi developed from scratch with historical data analytics and a financial learning management system (LMS). Built with Microservices, Redis, Node.js, AWS EKS, .NET 6, PostgreSQL, NATS, Flutter (BLoC), and Dart.",
      "features": [
        { "name": "PSX Live Feed Integration", "detail": "Live feed integration for the Pakistan Stock Exchange." },
        { "name": "Ktrade Saudi Microservices Platform", "detail": "Dedicated microservices version for Ktrade Saudi developed from scratch." },
        { "name": "Saudi Market Tadawul Integrations", "detail": "Market data and trading integrations for Saudi market Tadawul." },
        { "name": "Historical Data Analytics", "detail": "Data analytics and performance insights on historical financial and market data." },
        { "name": "Financial LMS on Ktrade Saudi", "detail": "Learning management system enabling users to learn about financial markets, investing, and trading principles." }
      ],
      "technologies": [
        "Microservices",
        "Redis",
        "Node.js",
        "AWS EKS",
        ".NET 6",
        "PostgreSQL",
        "NATS",
        "Flutter (BLoC)",
        "Dart",
        "Historical Data Analytics",
        "Financial LMS",
        "PSX Feed",
        "Tadawul",
        "Ocelot API Gateway"
      ],
      "tags": [
        "Fintech",
        "Trading",
        "Microservices",
        "Ktrade",
        "Historical Data Analytics",
        "Financial LMS",
        "Ktrade Saudi",
        "Redis",
        "Node.js",
        "AWS EKS",
        ".NET 6",
        "PostgreSQL",
        "NATS",
        "Flutter",
        "Dart",
        "PSX",
        "Tadawul",
        "Ocelot"
      ],
      "relatedSkills": [
        "sk-microservices",
        "sk-redis",
        "sk-nodejs",
        "sk-k8s",
        "sk-dotnet",
        "sk-postgres",
        "sk-nats",
        "sk-flutter",
        "sk-dart",
        "sk-ocelot"
      ],
      "relatedExperience": ["exp-ktrade"],
      "featured": True
    },
    {
      "id": "prod-learn-to-invest",
      "slug": "learn-to-invest",
      "name": "Learn to Invest",
      "tagline": "Fintech and trading platform",
      "category": "Fintech & Trading",
      "organisation": "Ktrade",
      "period": {
        "startDate": "2021",
        "endDate": "2022",
        "ongoing": False
      },
      "status": "live",
      "source": { "type": "closed-source" },
      "summary": "Virtual trading and gamified investment platform by Ktrade with PSX live feeds, leagues, and runtime leaderboards, integrated into the JazzCash app as backend.",
      "description": "Learn to Invest is a fintech and trading platform developed at Ktrade. Users can buy and sell on a virtual trading engine, play investment games, create and participate in trading leagues, and track runtime leaderboards with PSX stock live feed integration. Built with .NET 3.1, AWS MemoryDB, DynamoDB, and REST APIs, and integrated into the JazzCash mobile app as backend.",
      "features": [
        {
          "name": "Virtual Trading Engine & Games",
          "detail": "Enables users to buy and sell on a virtual trading engine and play investment games."
        },
        {
          "name": "Leagues & Tournaments",
          "detail": "Allows users to create trading leagues and participate in investment competitions."
        },
        {
          "name": "Runtime Leaderboard",
          "detail": "Real-time runtime leaderboard tracking portfolio performance and ranks."
        },
        {
          "name": "JazzCash App Backend Integration",
          "detail": "Integrated directly into the JazzCash mobile app as its backend for trading leagues and competitions."
        },
        {
          "name": "PSX Stock Live Feed Integration",
          "detail": "Live stock feed integration for the Pakistan Stock Exchange (PSX)."
        }
      ],
      "technologies": [
        ".NET 3.1",
        "AWS MemoryDB",
        "DynamoDB",
        "REST APIs",
        "AWS API Gateway",
        "Virtual Trading Engine",
        "JazzCash Integration",
        "PSX Stock Live Feed"
      ],
      "tags": [
        "Fintech",
        "Trading",
        "Virtual Trading Engine",
        "Leagues",
        "Leaderboard",
        "JazzCash Integration",
        "Ktrade",
        ".NET 3.1",
        "AWS MemoryDB",
        "DynamoDB",
        "REST APIs",
        "AWS API Gateway",
        "PSX"
      ],
      "relatedSkills": [
        "sk-dotnet",
        "sk-memorydb",
        "sk-dynamodb",
        "sk-rest-apis",
        "sk-aws-api-gateway"
      ],
      "relatedExperience": ["exp-ktrade"],
      "featured": True
    }
  ],
  "projects": [
    {
      "id": "proj-lab",
      "slug": "lab-nomanali-online",
      "name": "lab.nomanali.online — Personal Engineering Lab & Live Playground",
      "organisation": "Independent",
      "status": "active",
      "source": {
        "type": "open-source"
      },
      "period": {
        "startDate": "2026-09",
        "ongoing": True
      },
      "summary": "A personal engineering lab and live playground site (lab.nomanali.online) for independent experiments, interactive micro-tools, and technical explorations spanning computer vision, agentic AI, and UI engineering.",
      "description": "**lab.nomanali.online** is Noman Ali's independent engineering lab and experiments space — an always-evolving live playground for ideas, micro-tools, and interactive technical explorations outside of client and enterprise engagements.\n\nIt hosts proof-of-concepts, visual computer vision demos, agentic AI orchestrations, distributed systems prototypes, and modern UI experiments. Built to run on high agency and curiosity: ship fast, test hypotheses empirically in the browser, and document key findings.\n\nThe lab is independently hosted at `lab.nomanali.online` and embedded directly as an interactive live preview.",
      "concept": "A personal engineering lab — a live site for independent micro-experiments, demos, and explorations across computer vision, distributed systems, and agentic AI.",
      "problem": "Need for an unconstrained, zero-ceremony sandbox to rapidly prototype computer vision algorithms, micro-tools, agentic workflows, and creative frontend interfaces without client NDA restrictions or production overhead.",
      "hypothesis": "Maintaining a continuous, publicly accessible live lab environment fosters rapid iteration, lets visitors interact directly with live web demos via embedded sandboxes, and accelerates empirical validation of ideas.",
      "approach": "Engineered an independent experimental hub at lab.nomanali.online hosting micro-tools, proof-of-concepts, visual demos, and technical experiments across computer vision, distributed systems, agentic AI, and UI engineering.",
      "implementation": "Lightweight Next.js and static micro-frontends with embedded iframes, WebAssembly/ONNX runtime demos, and independent continuous deployment pipelines.",
      "results": "Serves as an active, live testbed for experimental features and interactive demonstrators before integrating components into larger production systems.",
      "lessons": [
        "Isolating experiments into standalone micro-demos prevents prototype bloat",
        "Embedding interactive iframes with sandbox isolation allows live experimentation without compromising parent security",
        "Zero-friction deployment leads to faster feedback cycles and rapid prototyping"
      ],
      "futureWork": [
        "Expand real-time in-browser WebAssembly/WebGPU computer vision demos",
        "Integrate live agentic reasoning playgrounds and interactive LLM agent workflows"
      ],
      "media": [
        {
          "type": "iframe",
          "url": "https://lab.nomanali.online",
          "title": "lab.nomanali.online — Live Interactive Playground",
          "caption": "Live personal lab and engineering experiments site (lab.nomanali.online). Interactive preview embedded via iframe.",
          "ratio": 1.777,
          "order": 0,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Open lab.nomanali.online",
          "url": "https://lab.nomanali.online",
          "type": "website"
        }
      ],
      "technologies": [
        "Independent",
        "Computer Vision",
        "Distributed Systems",
        "Agentic AI",
        "UI Engineering",
        "TypeScript",
        "Next.js",
        "Python"
      ],
      "tags": ["Personal", "Lab", "Experiments", "Playground", "Open", "Independent"],
      "featured": True
    },
    {
      "id": "proj-navirox",
      "slug": "navirox",
      "name": "NAVIROX — Autonomous Unmanned Vessel CV & 360° LiDAR Fusion POC",
      "organisation": "QBS Co.",
      "status": "prototype",
      "source": {
        "type": "closed-source",
        "note": "Client Research & Engineering POC"
      },
      "period": {
        "startDate": "2026-02-01",
        "endDate": "2026-07-31",
        "ongoing": False
      },
      "summary": "Engineering proof-of-concept integrating real-time computer vision object detection with unmanned surface vessels, 4-camera panoramic perception, 360° LiDAR depth fusion for range estimation, drone visual integration, and low-latency Flutter telemetry over MQTT.",
      "description": "**NAVIROX** was a high-stakes engineering proof-of-concept developed at QBS Co. from February to July 2026, built to answer one question: can you give an unmanned surface vessel the ability to *see*, *measure*, and *think* in real time?\n\n**What It Was**\nA multimodal perception system for autonomous unmanned vessels — combining cameras, LiDAR, and drone feeds into a single edge-compute intelligence layer capable of detecting obstacles, estimating distances, and feeding spatial data into mission planning engines.\n\n**4-Camera Array + 360° LiDAR Fusion**\nFour surround cameras gave the vessel panoramic visual coverage. A synchronized 360° LiDAR sensor added real depth — computing precise distance, range, and bearing to maritime obstacles, other surface vessels, and navigational markers. The two modalities were fused so every visual detection came with an accurate spatial measurement, not just a bounding box.\n\n**Edge AI on NVIDIA Jetson**\nAll inference ran locally on embedded NVIDIA Jetson hardware — no cloud, no latency. Object detection models were optimized with TensorRT for FP16 acceleration, sustaining 30+ FPS across all cameras under strict power and thermal constraints. Edge-first by design.\n\n**Drone Integration → Mission Planning**\nAerial drone feeds were pulled into the same perception pipeline. Detections from the drone — objects, vessels, coastlines — were translated into spatial parameters and injected directly into the vessel's mission planning and navigation trajectory engine. The drone became a scout; the vessel responded autonomously.\n\n**MQTT Telemetry + Flutter Cockpit**\nAll live data — vessel velocity, LiDAR point clouds, detection alerts, and spatial coordinates — was streamed over lightweight MQTT broker channels to a custom Flutter tablet and mobile application. Field operators could monitor the vessel's full situational awareness in real time from anywhere.\n\nThe POC was field-validated with working multimodal perception, accurate 50-metre obstacle distance estimation, drone-to-vessel mission coordination, and sub-second telemetry responsiveness.",
      "concept": "Multimodal sensor fusion combining a 4-camera surround vision array, 360° LiDAR point clouds, and aerial drone feeds onto edge-compute unmanned vessels for autonomous obstacle detection and mission planning.",
      "problem": "Unmanned surface vessels operating in maritime environments face severe perception challenges: single-camera setups lack depth accuracy in open water, while standalone LiDAR struggles to semantically classify obstacles. Constrained edge compute on embedded hardware requires sub-30ms perception latency for safe navigation.",
      "approach": "Engineered an edge multimodal perception pipeline on NVIDIA Jetson using TensorRT-accelerated deep learning detectors in Python. Fused 2D detections from 4 surround cameras with spatial depth from 360° LiDAR returns, integrated drone aerial detections into mission trajectory planning, and streamed telemetry over MQTT to a Flutter operator cockpit.",
      "implementation": "Built the core perception daemon in Python with TensorRT and CUDA optimizations on NVIDIA Jetson. Synchronized timestamped frames across 4 USB/MIPI cameras and mapped 360° LiDAR range bins to camera bounding frustums for distance estimation. Connected aerial drone detection streams to the vessel's mission planner, and published JSON telemetry packets over MQTT topics (QoS 1) consumed by a custom Flutter BLoC telemetry app.",
      "results": "Successfully demonstrated working multimodal perception in field trials: real-time 4-camera surround detection at 30+ FPS on Jetson, accurate obstacle distance estimation up to 50 meters via 360° LiDAR fusion, coordinated drone-to-vessel mission parameterization, and responsive sub-second telemetry updates in the Flutter app.",
      "lessons": [
        "LiDAR-camera spatial calibration requires rigid mounting rigs and vibration dampening on marine hulls to avoid calibration drift during wave motion.",
        "TensorRT FP16 serialization is critical for sustaining 30 FPS multi-camera inference on edge Jetson hardware without thermal throttling.",
        "MQTT with QoS 1 delivers resilient telemetry and state synchronization even across fluctuating 4G/LTE and local Wi-Fi bridges."
      ],
      "futureWork": [
        "Extending the LiDAR-camera fusion pipeline to 3D bounding box estimation via PointPillars or BEV (Bird's-Eye-View) architectures.",
        "Integrating ROS2 (Robot Operating System) navigation stacks for autonomous obstacle avoidance maneuvers based on fused distance fields.",
        "Adding edge-to-cloud telemetry sync for fleet-wide mission replay and sensor health diagnostics."
      ],
      "architecture": {
        "summary": "Edge multimodal perception and telemetry architecture on NVIDIA Jetson fusing 4 surround cameras, 360° LiDAR, and drone feeds with an MQTT broker and Flutter telemetry cockpit.",
        "layers": [
          {
            "name": "Surround Vision & Aerial Ingestion",
            "detail": "Captures and synchronizes 4 onboard surround cameras plus wireless video telemetry from reconnaissance drones.",
            "technologies": ["Python", "OpenCV", "RTSP", "4-Camera Array"]
          },
          {
            "name": "Edge Deep Learning & TensorRT Engine",
            "detail": "Executes accelerated object detection and semantic classification directly on NVIDIA Jetson hardware.",
            "technologies": ["NVIDIA Jetson", "TensorRT", "CUDA", "PyTorch", "Python"]
          },
          {
            "name": "360° LiDAR Spatial Fusion",
            "detail": "Projects 360° LiDAR point-cloud range returns onto 2D camera bounding boxes to calculate exact obstacle distances and bearings.",
            "technologies": ["360 LiDAR", "Sensor Fusion", "Point Cloud", "NumPy"]
          },
          {
            "name": "Mission Planning & Drone Integration",
            "detail": "Translates visual and LiDAR detections from vessel and drone into spatial avoidance parameters for autonomous mission trajectory planning.",
            "technologies": ["Mission Planning", "Drone Integration", "Autonomous Navigation"]
          },
          {
            "name": "Telemetry & Operator Cockpit",
            "detail": "Dispatches high-frequency vessel telemetry and obstacle alerts over MQTT to a cross-platform Flutter tablet application.",
            "technologies": ["MQTT", "Flutter", "BLoC", "Dart", "Cross-Platform"]
          }
        ]
      },
      "technologies": [
        "Python",
        "NVIDIA Jetson",
        "TensorRT",
        "360 LiDAR",
        "Sensor Fusion",
        "MQTT",
        "Flutter",
        "Computer Vision",
        "Object Detection",
        "Drone Integration",
        "Mission Planning",
        "Edge AI",
        "CUDA",
        "PyTorch",
        "Autonomous Vessels"
      ],
      "tags": [
        "Computer Vision",
        "LiDAR Fusion",
        "Unmanned Vessels",
        "NVIDIA Jetson",
        "TensorRT",
        "MQTT",
        "Flutter",
        "Drone Integration",
        "Mission Planning",
        "Edge AI",
        "QBS Co.",
        "POC"
      ],
      "relatedExperience": ["exp-qbs"],
      "relatedSkills": [
        "sk-python",
        "sk-pytorch-cuda",
        "sk-tensorrt",
        "sk-mqtt",
        "sk-flutter",
        "sk-arch",
        "sk-async-processing"
      ],
      "featured": True
    },
    {
      "id": "proj-zero-shots-trackers",
      "slug": "zero-shots-trackers",
      "name": "Zero-Shot & Open-Vocabulary Visual Tracking Suite",
      "organisation": "Independent",
      "status": "live",
      "source": {
        "type": "open-source",
        "url": "https://github.com/nomi181472/zero-shots-trackers"
      },
      "period": {
        "startDate": "2026-09-01",
        "ongoing": True
      },
      "summary": "A personal learning repository and concept collection for zero-shot tracking algorithms. Not an actual product; created to collect sample code with more zero-shot trackers added over time.",
      "description": "This repository is created strictly for learning purposes, understanding tracking concepts, and collecting sample code for zero-shot and open-vocabulary tracking. This is not an actual commercial product.\n\nThe repository serves as a personal collection of sample implementations and reference code exploring zero-shot tracking techniques (including GroundingDINO, ByteTrack, SORT, CLIP embeddings, OSTrack, and STARK). More zero-shot tracker implementations and sample code will continue to be added over time.\n\nGitHub: https://github.com/nomi181472/zero-shots-trackers",
      "concept": "Learning repository and sample code collection for zero-shot and open-vocabulary tracking concepts.",
      "problem": "Exploring and understanding how zero-shot and open-vocabulary visual tracking concepts work in practice.",
      "approach": "Collect sample code, reference implementations, and concept prototypes of different zero-shot tracking algorithms in a single repository.",
      "results": "Working reference sample code and concept demonstrations for zero-shot tracking, with additional trackers to be added over time.",
      "technologies": [
        "Python",
        "FastAPI",
        "Next.js",
        "React",
        "TypeScript",
        "PyTorch",
        "CUDA",
        "OpenCV",
        "GroundingDINO",
        "CLIP",
        "ByteTrack",
        "SORT",
        "OSTrack",
        "STARK",
        "Multi-Object Tracking",
        "Zero-Shot Tracking",
        "Open-Vocabulary Detection",
        "Visual Re-ID",
        "RAG",
        "Embeddings",
        "LLM Integration",
        "REST APIs",
        "FFmpeg",
        "Real-Time Video Streaming",
        "Docker",
        "Kubernetes",
        "Git",
        "pytest",
        "C#",
        ".NET",
        "Go"
      ],
      "tags": [
        "Computer Vision",
        "Zero-Shot Tracking",
        "Open-Vocabulary Detection",
        "GroundingDINO",
        "CLIP",
        "OSTrack",
        "STARK",
        "RAG",
        "FastAPI",
        "Next.js",
        "PyTorch",
        "CUDA",
        "Real-Time Video Streaming",
        "pytest"
      ],
      "links": [
        {
          "label": "GitHub: https://github.com/nomi181472/zero-shots-trackers",
          "url": "https://github.com/nomi181472/zero-shots-trackers",
          "type": "repository",
          "visibility": "public"
        }
      ],
      "relatedSkills": [
        "sk-python",
        "sk-csharp",
        "sk-dotnet",
        "sk-go",
        "sk-typescript",
        "sk-pytorch-cuda",
        "sk-fastapi",
        "sk-frontend-nextjs",
        "sk-video-streaming",
        "sk-docker-compose",
        "sk-k8s",
        "sk-git",
        "sk-testing-pytest",
        "sk-pgvector",
        "sk-qdrant",
        "sk-tensorrt",
        "sk-onnx"
      ],
      "featured": True
    },
    {
      "id": "proj-tracker-simulator",
      "slug": "tracker-failure-simulator",
      "name": "Tracker Failure Simulator — Visual Multi-Object Tracking & Evaluation Lab",
      "organisation": "Independent",
      "status": "live",
      "source": {
        "type": "open-source",
        "url": "https://github.com/nomi181472/trackers",
        "note": "Independent Project"
      },
      "period": {
        "startDate": "2025-07-01",
        "ongoing": True
      },
      "summary": "Independent interactive visual lab for simulating multi-object trackers to discover their weaknesses using ground truth versus actual behavior.",
      "description": "An independent project created to investigate and stress-test visual tracking architectures. In this project, I will be adding more tracker simulations to investigate and benchmark their weaknesses using ground truth versus actual behavior under stress.\n\nIt provides an interactive visual computer vision lab designed to discover why and how multi-object trackers fail. Features dual operating modes: a Synthetic Simulator with deterministic ground truth physics (linear velocity, crossing trajectories, occlusion, camera jitter, detection noise) and a Real Video YOLO Mode for running detectors and trackers on live footage. Implements side-by-side MOTA, MOTP, IDF1, precision/recall, and ID switch evaluations alongside automated natural-language weakness report cards across 16 tracker algorithms.\n\nGitHub: https://github.com/nomi181472/trackers",
      "concept": "Simulating multi-object trackers to analyze their weaknesses using ground truth versus actual behavior.",
      "problem": "Multi-object trackers frequently fail under severe occlusion, sensor noise, crossing trajectories, and missed detections, but diagnosing failure root causes in production video feeds is difficult without comparing actual behavior against deterministic ground truth.",
      "approach": "Built a dual-mode evaluation framework combining an interactive Next.js and TypeScript frontend with a high-performance Python/FastAPI backend utilizing REST APIs and async processing, orchestrated via Docker Compose. Generates parametric synthetic ground truth and integrates real-world YOLO inference with 16 tracker algorithms (ByteTrack, BoT-SORT, OC-SORT, DeepOCSORT, OpenCV classic trackers), computing real-time MOT metrics and weakness report cards.",
      "results": "Enables reproducible side-by-side benchmark evaluation of 16 tracking algorithms, discovering weaknesses and surfacing identity switches, false trajectories, and localization drift under adversarial conditions.",
      "technologies": [
        "Python",
        "FastAPI",
        "REST APIs",
        "Async Processing",
        "Next.js",
        "TypeScript",
        "Docker Compose",
        "OpenCV",
        "Ultralytics",
        "ByteTrack",
        "BoT-SORT",
        "OC-SORT",
        "DeepOCSORT"
      ],
      "tags": [
        "Computer Vision",
        "Multi-Object Tracking",
        "Ground Truth Simulation",
        "Weakness Analysis",
        "ByteTrack",
        "BoT-SORT",
        "OC-SORT",
        "DeepOCSORT",
        "FastAPI",
        "Next.js",
        "Docker Compose"
      ],
      "links": [
        {
          "label": "GitHub: https://github.com/nomi181472/trackers",
          "url": "https://github.com/nomi181472/trackers",
          "type": "repository",
          "visibility": "public"
        }
      ],
      "media": [
        {
          "type": "gif",
          "url": "/media/tracker-simulator-demo.gif",
          "title": "Side-by-Side Tracker Stress Evaluation",
          "caption": "Real-time demonstration comparing ByteTrack, BoT-SORT, Greedy IoU, and Centroid trackers under severe occlusions.",
          "alt": "Animated GIF demonstration of Tracker Failure Simulator side-by-side tracker evaluation",
          "ratio": 0.95
        },
        {
          "type": "image",
          "url": "/media/tracker-dashboard-results.png",
          "title": "Tracker Lab Dashboard & Natural-Language Report Card",
          "caption": "Comprehensive multi-tracker performance reports, event timelines, and automated failure explanations.",
          "alt": "Tracker simulator lab dashboard and evaluation results",
          "ratio": 1.58
        },
        {
          "type": "image",
          "url": "/media/tracker-snapshot.png",
          "title": "Scenario Generator & Failure Controls",
          "caption": "Interactive scenario generator: crossing trajectories, occlusion wall, camera shake, and detector noise.",
          "alt": "Synthetic failure scenario generator controls",
          "ratio": 1.65
        }
      ],
      "relatedSkills": [
        "sk-python",
        "sk-fastapi",
        "sk-rest-apis",
        "sk-async-processing",
        "sk-frontend-nextjs",
        "sk-typescript",
        "sk-docker-compose"
      ],
      "featured": True
    },
    {
      "id": "proj-microservices-template",
      "slug": "microservices-template",
      "name": "Enterprise Cloud-Native Microservices Template & Reusable Platform Modules",
      "organisation": "QBS Co.",
      "status": "live",
      "source": {
        "type": "closed-source",
        "note": "Internal Enterprise Chassis"
      },
      "period": {
        "startDate": "2025-01-01",
        "endDate": "2026-01-31",
        "ongoing": False
      },
      "summary": "Standardized enterprise microservices chassis and reusable modules (Auth/RBAC/IAM, Notifications, Messaging) conceived during AJEEK platform development and now powering 10+ production projects across QBS Co.",
      "description": "During rapid development across multiple products and projects at QBS Co., teams faced a major architectural challenge: repeatedly reinventing core infrastructure blocks—such as Authentication, RBAC, Notifications, and Messaging—for each new application. Conceived and extracted during the development of the AJEEK platform, this initiative designed and standardized modular, reusable microservice templates so engineering squads never have to rebuild cross-cutting foundations again.\n\nThe cornerstone of this architecture is a mature Auth / RBAC / IAM module that connects dynamically to all participating microservices at runtime to discover their API endpoints for real-time RBAC policy enforcement. Upon authentication, it generates an authoritative security ticket/token that controls and validates access across all downstream microservices and remaining APIs. Standardized notification and messaging modules were similarly extracted into turnkey templates, enabling rapid kickoff across 10+ production projects at QBS Co. with zero redundant boilerplate.",
      "concept": "Reusable, plug-and-play enterprise microservices templates (Auth/RBAC, Notifications, Messaging) featuring runtime API endpoint discovery and unified ticket-based authorization.",
      "problem": "Across multiple new products and projects at QBS Co. (starting during the development of AJEEK), squads repeatedly spent months building isolated auth, notification, and messaging services from scratch, leading to code duplication, inconsistent RBAC, and heavy maintenance overhead.",
      "approach": "Architected modular microservices templates in .NET Core and Go. Engineered a centralized Auth & IAM module that connects with all microservices to discover their endpoints at runtime for granular RBAC operations, generating a single authoritative security ticket that governs all remaining APIs. Packaged companion plug-and-play notification and messaging templates.",
      "results": "Eliminated repetitive platform development across QBS Co. The Auth/RBAC template achieved full maturity and is now deployed in 10+ production projects, cutting new service kickoff times, enforcing unified single-ticket API security, and establishing reusable architectural standards.",
      "technologies": [
        "Microservices Architecture",
        ".NET Core",
        "Go",
        "RBAC / IAM",
        "Dynamic Endpoint Discovery",
        "Security Tickets & Tokens",
        "Notification Services",
        "Messaging Services",
        "Ocelot API Gateway",
        "Docker",
        "Kubernetes"
      ],
      "tags": [
        "Microservices Template",
        "Auth",
        "RBAC",
        "IAM",
        "Dynamic Discovery",
        "Security Tokens",
        "Notification Service",
        "Messaging Service",
        "AJEEK",
        "QBS Co.",
        ".NET Core",
        "Go",
        "Ocelot"
      ],
      "relatedSkills": [
        "sk-microservices",
        "sk-arch",
        "sk-dotnet",
        "sk-go",
        "sk-ocelot",
        "sk-iam",
        "sk-rest-apis"
      ],
      "relatedProducts": ["prod-ajeek"],
      "relatedExperience": ["exp-qbs"],
      "featured": True
    },
    {
      "id": "proj-resume-hr",
      "slug": "resume-hr",
      "name": "ResumeHR — Agentic Candidate Screening & Knowledge Distillation",
      "organisation": "QBS Co.",
      "status": "live",
      "source": {
        "type": "closed-source",
        "note": "Internal QBS Co. In-House Platform"
      },
      "period": {
        "startDate": "2025-03-01",
        "endDate": "2025-08-31",
        "ongoing": False
      },
      "summary": "In-house agentic HR candidate screening platform at QBS Co. automating bulk resume evaluation, semantic candidate-job matching, and LLM fine-tuning via knowledge distillation.",
      "description": "ResumeHR is an in-house agentic AI platform engineered for QBS Co. to automate bulk resume screening and match candidates to open job roles with high precision. Handling high volumes of candidate submissions, the platform parses unstructured CVs and resumes, extracts structured professional profiles (competencies, career progression, skills, educational credentials), and semantically ranks applicants against specific job descriptions.\n\nTo achieve fast, high-throughput inference without the latency and high API costs of large frontier models, the platform utilizes **Knowledge Distillation**. Reasoning and ranking capabilities from larger teacher models are distilled into compact, fine-tuned student LLMs specifically optimized for resume-job description alignment. The system features a hybrid Retrieval-Augmented Generation (RAG) pipeline combined with LangChain agentic workflows, supported by a robust C# / .NET Core backend for bulk file ingestion, document storage, and recruiter dashboards.",
      "concept": "Agentic bulk resume parsing, semantic candidate-job matching, and knowledge-distilled fine-tuning for high-throughput in-house HR candidate screening.",
      "problem": "Manual screening of hundreds of bulk applicant resumes is time-consuming, prone to human fatigue, and costly when relying on standard commercial LLM API calls per document.",
      "approach": "Architected an agentic pipeline using Python, LangChain, and RAG for dense vector semantic matching, coupled with knowledge distillation to fine-tune a compact, low-latency student model for candidate scoring. Built the enterprise backend and document ingestion services using C# and .NET Core.",
      "results": "Automated end-to-end bulk resume processing at QBS Co., delivering instant candidate-job semantic ranking, explainable relevance breakdowns for HR teams, and dramatic reductions in inference latency and cost via distilled models.",
      "technologies": [
        "Python",
        "RAG",
        "C#",
        ".NET Core",
        "LangChain",
        "LLMs",
        "Knowledge Distillation",
        "Vector Search",
        "Agentic Workflows"
      ],
      "tags": [
        "ResumeHR",
        "Agentic AI",
        "Knowledge Distillation",
        "RAG",
        "LangChain",
        "LLMs",
        "Python",
        "C#",
        ".NET",
        "HR Tech",
        "Candidate Screening",
        "QBS Co."
      ],
      "relatedSkills": [
        "sk-python",
        "sk-csharp",
        "sk-dotnet",
        "sk-langchain",
        "sk-rag"
      ],
      "relatedExperience": ["exp-qbs"],
      "featured": True
    },
    {
      "id": "proj-need",
      "slug": "need-neuroevolution-framework",
      "name": "NEED — Neuro-Evolution for Effective Decision",
      "organisation": "Independent (NUCES-FAST)",
      "status": "live",
      "source": {
        "type": "open-source",
        "url": "https://github.com/nomi181472/need",
        "note": "Open Source Research Framework"
      },
      "period": {
        "startDate": "2024-07-01",
        "endDate": "2025-07-31",
        "ongoing": False
      },
      "summary": "Neuro-Evolution for Effective Decision (NEED) — master's final year project at NUCES-FAST training and optimizing RL agents with minimal parameters (e.g. Lunar Lander in only 96 params) without backpropagation. Currently developing v2 for formal publication.",
      "description": "NEED (Neuro-Evolution for Effective Decision) is an independent research framework developed during Master of Science in Data Science studies at NUCES-FAST. The project explores evolutionary algorithms to train and optimize compact neural policies from noise, completely gradient-free without backpropagation.\n\nWhile backpropagation is optimal for supervised and unsupervised learning due to smooth, differentiable loss landscapes, it frequently struggles in reinforcement learning with sparse reward signals, high gradient variance, and deceptive local optima. NEED demonstrates that evolutionary algorithms excel in RL by directly searching the parameter space without gradient calculations, value estimators, or reward differentiability constraints.\n\nKey Highlights & Achievements:\n- **Ultra-Minimal Parameter Footprint**: Successfully trained an agent to master the Gymnasium Lunar Lander environment with only **96 parameters**, achieving top-tier average scores and perfectly stable touchdowns.\n- **Zero Backpropagation**: Evolved policies purely through population selection, uniform crossover, polynomial mutation, and novelty-driven fitness diversity.\n- **Multi-Environment Evaluation**: Evaluated across 8 Gymnasium domains (Lunar Lander, HalfCheetah, Walker2d, Humanoid Standup, Ant, Swimmer, CartPole, and Humanoid) with 500+ archived policy runs.\n- **Live Research & v2 Roadmap**: Live interactive research platform, video recordings, and benchmarks deployed at https://need.nomanali.online/v1. Actively working on **v2** for formal academic publication.",
      "concept": "Gradient-free neural policy optimization using evolutionary algorithms to achieve high-performance decision-making with minimal parameter footprints.",
      "problem": "Traditional reinforcement learning relies on backpropagation, requiring massive compute, dense reward engineering, and millions of parameters that often fail under deceptive reward landscapes.",
      "approach": "Engineered an evolutionary policy search engine leveraging PyTorch, JAX, EvoTorch, and Ray. Evaluates diverse populations across parallel Gymnasium environments, combining novelty search with fitness gating without gradient updates. Establishes the theoretical and empirical advantages of evolutionary optimization over backpropagation in reinforcement learning.",
      "results": "Achieved perfect autonomous Lunar Lander landings with only 96 parameters and top average scores. Recorded 500+ policy runs across 8 bodies; deployed live research portal at need.nomanali.online/v1 with v2 in active development for academic publication.",
      "technologies": [
        "Python",
        "PyTorch",
        "JAX",
        "EvoTorch",
        "Ray",
        "Gymnasium",
        "Evolutionary Algorithms",
        "Neuroevolution",
        "Reinforcement Learning",
        "Gradient-Free Optimization"
      ],
      "tags": [
        "Neuroevolution",
        "Evolutionary Algorithms",
        "Reinforcement Learning",
        "Gradient-Free",
        "NEED",
        "Lunar Lander",
        "PyTorch",
        "JAX",
        "EvoTorch",
        "Ray",
        "NUCES-FAST",
        "Gymnasium"
      ],
      "media": [
        {
          "type": "iframe",
          "url": "https://need.nomanali.online/v1",
          "title": "NEED v1 Live Research Platform & Video Archive",
          "caption": "Live research platform and policy recordings archive for NEED v1 at need.nomanali.online/v1 (Master's FYP at NUCES-FAST)."
        }
      ],
      "links": [
        {
          "label": "NEED v1 Live Research Platform",
          "url": "https://need.nomanali.online/v1",
          "type": "website",
          "visibility": "public"
        },
        {
          "label": "NEED GitHub Repository",
          "url": "https://github.com/nomi181472/need",
          "type": "repository",
          "visibility": "public"
        }
      ],
      "relatedSkills": [
        "sk-python",
        "sk-pytorch-cuda",
        "sk-jax",
        "sk-evotorch",
        "sk-ray"
      ],
      "relatedEducation": ["edu-ms"],
      "featured": True
    },
    {
      "id": "proj-payment-middleware",
      "slug": "payment-middleware",
      "name": "Unified Payment Middleware — Fuelinks Integration",
      "organisation": "QBS Co.",
      "status": "live",
      "source": {
        "type": "closed-source",
        "note": "Commercial Middleware"
      },
      "period": {
        "startDate": "2024-03-01",
        "endDate": "2024-09-01",
        "ongoing": False
      },
      "summary": "Centralized payment integration middleware developed at QBS Co. integrating the Fuelinks payment gateway across both Vibe product and BLUE product platforms.",
      "description": "Engineered a resilient, centralized payment integration middleware at QBS Co. to orchestrate secure transactions and payment processing via the Fuelinks payment gateway. The middleware serves as a unified abstraction layer connecting Fuelinks to both the Vibe product and the BLUE gas cylinder logistics platform, managing checkout initiation, webhook reconciliation, idempotency, refund processing, and transactional settlement.",
      "concept": "Unified transaction and payment gateway middleware abstracting Fuelinks payment processing for multiple client platforms.",
      "problem": "Directly coupling individual products (Vibe and BLUE) to third-party payment APIs led to fragmented transaction logic, inconsistent reconciliation, and repeated gateway integration overhead.",
      "approach": "Architected a centralized payment middleware service integrating the Fuelinks payment gateway, providing unified REST/webhook interfaces, transaction status state machines, idempotent request handling, and automated payment verification for both Vibe and BLUE.",
      "results": "Standardized end-to-end payment processing across Vibe and BLUE products, enabling reliable checkout flows, real-time transaction confirmations, and automated webhook reconciliation with Fuelinks.",
      "technologies": [
        "Payment Gateway Integration",
        "Fuelinks",
        "Middleware",
        "REST APIs",
        "Webhooks",
        "Idempotency",
        "Transaction Reconciliation",
        "Microservices"
      ],
      "tags": [
        "Payment Middleware",
        "Fuelinks",
        "QBS Co.",
        "Fintech",
        "Payment Integration",
        "BLUE",
        "Vibe",
        "Webhooks",
        "REST APIs"
      ],
      "relatedSkills": [
        "sk-rest-apis",
        "sk-microservices",
        "sk-arch"
      ],
      "relatedProducts": ["prod-blue"],
      "relatedExperience": ["exp-qbs"],
      "featured": True
    },
    {
      "id": "proj-quant-rl-trading",
      "slug": "quantitative-rl-algorithmic-trading",
      "name": "Quantitative Algorithmic Trading & Reinforcement Learning Lab (PoC)",
      "organisation": "Ktrade Securities",
      "status": "prototype",
      "source": {
        "type": "closed-source",
        "note": "Internal Ktrade Securities R&D Lab"
      },
      "period": {
        "startDate": "2023-03-01",
        "endDate": "2023-10-31",
        "ongoing": False
      },
      "summary": "Quantitative development environment and reinforcement learning algorithmic trading engine developed at Ktrade Securities, powered by vectorbt, TimescaleDB, and Redis.",
      "description": "A quantitative finance and algorithmic trading research laboratory engineered at Ktrade Securities to investigate high-throughput vectorized backtesting and reinforcement learning decision policies for financial markets:\n\n1. **Vectorized Strategy Backtesting**: Built using vectorbt and Numba, enabling rapid matrix-based backtesting, parameter optimization sweeps, and drawdown analysis across multi-year asset histories without iterative loop bottlenecks.\n2. **High-Frequency Time-Series Storage**: Built on PostgreSQL with TimescaleDB hypertables, automating chunk partitioning, tick compression, and continuous aggregates for low-latency candlestick generation.\n3. **In-Memory Quote & Order Book Cache**: Integrated Redis for high-speed simulated order matching queues, real-time spread tracking, and live quote caching.\n4. **Reinforcement Learning Execution Engine**: Structured state-action-reward simulation environments using NumPy and Pandas to evaluate policy convergence for automated execution timing and slippage reduction.",
      "concept": "Vectorized backtesting and reinforcement learning decision policies for quantitative trade execution.",
      "problem": "Iterative backtesting frameworks are prohibitively slow for exploring complex parameter spaces, and standard relational engines struggle to ingest and compress high-frequency financial tick data.",
      "approach": "Architected a vectorized research and simulation pipeline using vectorbt, TimescaleDB, PostgreSQL, Redis, NumPy, and Pandas, training RL policy agents on historical tick and candlestick feeds.",
      "results": "Demonstrated sub-second multi-parameter optimization sweeps across tick datasets, automated continuous OHLCV rollups with TimescaleDB, and verified RL agent convergence under simulated transaction costs.",
      "technologies": [
        "vectorbt",
        "Python",
        "PostgreSQL",
        "TimescaleDB",
        "Redis",
        "NumPy",
        "Pandas",
        "Reinforcement Learning",
        "Algorithmic Trading",
        "Quantitative Development"
      ],
      "tags": [
        "Quantitative Development",
        "Algorithmic Trading",
        "Ktrade",
        "Ktrade Securities",
        "vectorbt",
        "TimescaleDB",
        "PostgreSQL",
        "Redis",
        "NumPy",
        "Pandas",
        "Reinforcement Learning",
        "PoC"
      ],
      "relatedSkills": [
        "sk-python",
        "sk-timescaledb",
        "sk-redis",
        "sk-postgres"
      ],
      "relatedExperience": ["exp-ktrade"],
      "featured": False
    },
    {
      "id": "proj-bscs-fyp",
      "slug": "ai-diet-exercise-recommendation-system",
      "name": "AI Diet & Exercise Recommendation System (BSCS Capstone)",
      "organisation": "Independent (NUCES-FAST)",
      "status": "live",
      "period": {
        "startDate": "2020-08-01",
        "endDate": "2021-07-30",
        "ongoing": False
      },
      "summary": "Full-stack fitness platform delivering personalized diet and exercise regimens powered by Mask R-CNN muscle assessment and Apriori recommendation algorithms.",
      "description": "Engineered as the Senior Final Year Capstone Project at NUCES-FAST, this platform automates personalized diet and workout regimens by first conducting an intelligent routine and visual body assessment. A computer vision pipeline segments and analyzes muscle groups using Mask R-CNN, while an Apriori association rule-mining engine personalizes macro-nutritional diets and exercise progressions based on individual fitness baselines.\n\nArchitected on an event-driven microservices infrastructure with NATS Streaming, Docker, and Kubernetes, the system decouples Express.js client-facing APIs (User, Exercise, Nutrition, and Tracking services) from asynchronous Python AI inference workers. A cross-platform React Native mobile client provides interactive macro tracking and routine guidance.\n\nThe core computer vision muscle assessment subsystem was subsequently presented at the 4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021) and published in IEEE Xplore.",
      "concept": "Automated physical and nutritional regimen generation through computer vision body assessment and association rule mining.",
      "problem": "Generic fitness apps provide static, one-size-fits-all workout and diet plans that fail to adapt to a user's actual muscular condition, physical baseline, or dietary habits, while personal trainers remain expensive.",
      "approach": "Built an event-driven microservices architecture using NATS Streaming, Docker, and Kubernetes. Deployed Python services leveraging Mask R-CNN for visual muscle assessment and Apriori rule mining for diet scheduling, integrated with a React Native mobile application and Express.js backends.",
      "results": "Awarded Grade A+ for the Senior Capstone Project. The underlying visual muscle assessment engine was peer-reviewed, presented at IEEE ICCIS 2021, and published in IEEE Xplore.",
      "technologies": [
        "Python",
        "PyTorch",
        "Mask R-CNN",
        "Apriori Algorithm",
        "NATS Streaming",
        "Docker",
        "Kubernetes",
        "React Native",
        "Node.js",
        "Express.js",
        "MongoDB",
        "Nginx"
      ],
      "media": [
        {
          "type": "image",
          "url": "/media/bscs-fyp.png",
          "title": "Diet & Exercise Recommendation System Architecture & Mobile App",
          "caption": "Official BSCS Final Year Capstone overview: React Native mobile interface, NATS event-driven microservices topology, and tech stack (NUCES-FAST).",
          "alt": "Diet and Exercise Recommendation System Architecture Diagram and Mobile App",
          "ratio": 0.447,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Published IEEE Research Paper",
          "url": "https://ieeexplore.ieee.org/document/9676387",
          "type": "article",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Computer vision muscle assessment service published in IEEE Xplore",
          "note": "Presented at the 4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021)",
          "links": [
            {
              "label": "IEEE Xplore Document: 9676387",
              "url": "https://ieeexplore.ieee.org/document/9676387",
              "type": "article"
            }
          ]
        }
      ],
      "relatedEducation": ["edu-bs"],
      "featured": True
    }
  ],
  "research": [
    {
      "id": "res-neuroevolution",
      "slug": "compute-efficient-neuroevolution",
      "name": "Compute-Efficient Neuroevolution for Deep Architectures",
      "state": "validated",
      "period": {
        "startDate": "2023-08-01",
        "endDate": "2024-12-31",
        "ongoing": False
      },
      "lastUpdated": "2024-04-12",
      "question": "Can weight-inheritance genetic operators reduce training FLOPs by >30% compared to conventional neural architecture search?",
      "abstract": "Investigation into weight preservation mechanics in evolving deep convolutional and transformer backbones on resource-constrained hardware.",
      "summary": "Research on compute-efficient neural architecture optimization through weight inheritance and genetic mutation.",
      "findings": [
        {
          "date": "2024-04-12",
          "observation": "Parent weight inheritance eliminates up to 40% of standard cold-start training epochs during evolutionary topology mutation.",
          "confidence": "high"
        }
      ],
      "technologies": ["PyTorch", "Python", "Genetic Algorithms"],
      "featured": True
    }
  ],
  "education": [
    {
      "id": "edu-ms",
      "slug": "fast-nuces-ms-data-science",
      "name": "MS in Data Science — NUCES-FAST",
      "institution": "National University of Computer and Emerging Sciences (NUCES-FAST)",
      "degree": "Master of Science (MS)",
      "field": "Data Science",
      "location": "Karachi, Pakistan",
      "period": {
        "startDate": "2023-08-01",
        "endDate": "2025-06-30",
        "ongoing": False
      },
      "summary": "Master of Science with focus on Deep Learning, Neuroevolutionary Algorithms, and Scalable Machine Learning Pipelines.",
      "description": "Master of Science in Data Science from National University of Computer & Emerging Sciences (NUCES-FAST), Islamabad (Roll No. 23K-8069). Specialized in deep learning systems, computer vision pipelines, and evolutionary algorithm architectures.",
      "achievements": [
        "Officially verified by NUCES-FAST under Roll No. 23K-8069 (Degree No. 25-2254).",
        "Engineered NEED: Neuroevolutionary Architecture Search framework cutting training FLOPs compared to traditional RL-based NAS.",
        "Conducted research on accelerating neural topology search with genetic weight inheritance."
      ],
      "subjects": ["Deep Learning", "Machine Learning at Scale", "Advanced Statistics", "Neuroevolution", "Computer Vision"],
      "technologies": ["Python", "PyTorch", "Neuroevolution", "Computer Vision", "Deep Learning"],
      "media": [
        {
          "type": "image",
          "url": "https://raw.githubusercontent.com/nomi181472/portfolio-os/refs/heads/main/media/ds.png",
          "title": "Master of Science in Data Science Degree",
          "caption": "Official MS Data Science degree certificate awarded by National University of Computer & Emerging Sciences (NUCES-FAST), Islamabad (Roll No. 23K-8069, Degree No. 25-2254).",
          "alt": "MS Data Science degree certificate awarded by NUCES-FAST to Noman Ali",
          "ratio": 1.235,
          "visibility": "public"
        },
        {
          "type": "image",
          "url": "https://raw.githubusercontent.com/nomi181472/portfolio-os/refs/heads/main/media/ds-transcript.png",
          "title": "Official Academic Transcript — MS Data Science",
          "caption": "Official MS Data Science academic transcript issued by NUCES-FAST Controller of Examinations (Roll No. 23K-8069).",
          "alt": "Official MS Data Science academic transcript for Noman Ali from NUCES-FAST",
          "ratio": 1.504,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Verify Degree (NUCES Official Portal)",
          "url": "https://www.nu.edu.pk/verification?id=23k-8069",
          "type": "verification",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Official Degree Verified by NUCES-FAST Portal",
          "note": "Registration ID: 23K-8069, Degree Serial: 25-2254",
          "links": [
            {
              "label": "Verify at nu.edu.pk",
              "url": "https://www.nu.edu.pk/verification?id=23k-8069",
              "type": "verification"
            }
          ]
        }
      ],
    },
    {
      "id": "edu-bs",
      "slug": "fast-nuces-bs-computer-science",
      "name": "BS in Computer Science — NUCES-FAST",
      "institution": "National University of Computer and Emerging Sciences (NUCES-FAST)",
      "degree": "Bachelor of Science (BS)",
      "field": "Computer Science",
      "location": "Karachi, Pakistan",
      "period": {
        "startDate": "2017-07-01",
        "endDate": "2021-07-30",
        "ongoing": False
      },
      "summary": "Bachelor of Science covering Distributed Systems, Operating Systems, Algorithm Design, and Machine Learning.",
      "description": "Graduated with a Bachelor of Science in Computer Science from National University of Computer & Emerging Sciences (NUCES-FAST), Islamabad (Roll No. 17K-3652). Completed 130 credit hours across Distributed Systems, Operating Systems, Computer Architecture, Data Structures, Networks, and Machine Learning.",
      "achievements": [
        "Officially verified by NUCES-FAST under Roll No. 17K-3652 (Degree No. 21-1180).",
        "Published IEEE research paper on human muscle assessment frameworks (IEEE Xplore, 2021).",
        "Recognized on HackerRank for algorithmic problem solving in C++.",
        "Completed Senior Capstone Project with A+ grade (CS 491 / CS 492)."
      ],
      "subjects": [
        "Distributed Systems",
        "Data Structures & Algorithms",
        "Operating Systems",
        "Computer Networks",
        "Database Systems",
        "Artificial Intelligence",
        "Computer Architecture"
      ],
      "technologies": [
        "C++",
        "Distributed Systems",
        "Linux",
        "Operating Systems",
        "Algorithms",
        "SQL"
      ],
      "media": [
        {
          "type": "image",
          "url": "/media/bscs.png",
          "title": "Bachelor of Science in Computer Science Degree",
          "caption": "Official BS Computer Science degree certificate awarded by National University of Computer & Emerging Sciences (NUCES-FAST), Islamabad (Roll No. 17K-3652, Degree No. 21-1180).",
          "alt": "Official BS Computer Science degree certificate awarded by NUCES-FAST to Noman Ali",
          "ratio": 1.224,
          "visibility": "public"
        },
        {
          "type": "image",
          "url": "/media/bscs-transcript.png",
          "title": "Official Academic Transcript — BS Computer Science",
          "caption": "Official academic transcript issued by NUCES-FAST Controller of Examinations (Roll No. 17K-3652).",
          "alt": "Official BS Computer Science academic transcript for Noman Ali from NUCES-FAST",
          "ratio": 0.987,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Verify Degree (NUCES Official Portal)",
          "url": "https://www.nu.edu.pk/verification?id=17k-3652",
          "type": "verification",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Official Degree Verified by NUCES-FAST Portal",
          "note": "Registration ID: 17K-3652, Degree Serial: 21-1180",
          "links": [
            {
              "label": "Verify at nu.edu.pk",
              "url": "https://www.nu.edu.pk/verification?id=17k-3652",
              "type": "verification"
            }
          ]
        }
      ],
    }
  ],
  "publications": [
    {
      "id": "pub-ieee-2021",
      "slug": "ieee-human-muscle-assessment",
      "name": "A Convolutional Neural Network-based Framework for the Assessment of Human Muscles",
      "period": {
        "startDate": "2021-11-29",
        "endDate": "2021-11-30",
        "ongoing": False
      },
      "authors": [
        "Rizwan Qureshi",
        "Noman Soomro (Noman Ali)",
        "Muhammad Abu Bakar",
        "Ali Raza Shahid",
        "Muhammad Bilal Shaikh",
        "Wayne Poon"
      ],
      "venue": "4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021) / IEEE Xplore",
      "citation": "2021 International Conference on Computing & Information Sciences (ICCIS), pp. 1-6, DOI: 10.1109/ICCIS54243.2021.9676387",
      "doi": "10.1109/ICCIS54243.2021.9676387",
      "abstract": "Derived directly from the computer vision muscle detection service developed for Noman's BSCS Final Year Capstone Project, this peer-reviewed research presents a convolutional neural network (CNN) pipeline for automated visual segmentation and assessment of human muscle anatomy. The paper was presented at the 4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021) organized by PAF-KIET, Karachi on November 29–30, 2021, and indexed in IEEE Xplore.",
      "summary": "Peer-reviewed research presented at IEEE ICCIS 2021 and published in IEEE Xplore on automated visual assessment of human muscles using deep convolutional neural networks.",
      "body": "### Background & Project Origin\n\nThis research originated directly from the computer vision muscle assessment service engineered during Noman's BSCS Final Year Capstone Project (**Diet & Exercise Recommendation System**) at NUCES-FAST.\n\n### Core Methodology\n\n- **Computer Vision Segmentation**: Implemented convolutional neural networks to localize and segment human muscle groups from standard RGB visual captures.\n- **Objective Diagnostics**: Created an automated physical assessment baseline to support data-driven rehabilitation, training, and physiotherapy.\n- **Downstream Association**: Provided sensory feedback to an event-driven recommendation engine (Apriori algorithm) for dynamic diet and workout scheduling.\n\n### Conference Presentation & Indexing\n\n- **Conference**: 4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021)\n- **Organizers**: College of Computing and Information Sciences, PAF-KIET, Karachi in collaboration with IEEE Karachi Section and Higher Education Commission (HEC)\n- **Presentation Date**: November 29–30, 2021\n- **IEEE Indexing**: Published in IEEE Xplore (Document ID: `9676387`, DOI: `10.1109/ICCIS54243.2021.9676387`).",
      "media": [
        {
          "type": "image",
          "url": "/media/conf-iccis.png",
          "title": "IEEE ICCIS 2021 Paper Presentation Certificate",
          "caption": "Official Certificate of Participation & Paper Presentation awarded to Noman Soomro for 'A Convolutional Neural Network-based Framework for the Assessment of Human Muscles' at the 4th IEEE ICCIS conference.",
          "alt": "IEEE ICCIS 2021 Paper Presentation Certificate",
          "ratio": 1.648,
          "visibility": "public"
        },
        {
          "type": "image",
          "url": "/media/iccis-group-photo.png",
          "title": "IEEE ICCIS 2021 Conference Presenters & Dignitaries",
          "caption": "Conference group photo at PAF-KIET with Noman Ali highlighted in the center.",
          "alt": "IEEE ICCIS 2021 Group Photo highlighting Noman Ali in center",
          "ratio": 1.48,
          "visibility": "public",
          "box": {
            "left": 37.4,
            "top": 33.0,
            "width": 7.2,
            "height": 17.0,
            "color": "#00f2fe"
          }
        },
        {
          "type": "image",
          "url": "/media/bscs-fyp.png",
          "title": "BSCS Capstone System Architecture & Mobile Interface",
          "caption": "The diet and exercise recommendation platform powering the muscle assessment visual pipeline.",
          "alt": "BSCS Capstone Architecture and Mobile App",
          "ratio": 0.447,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "IEEE Xplore Publication",
          "url": "https://ieeexplore.ieee.org/document/9676387",
          "type": "article",
          "visibility": "public"
        },
        {
          "label": "Google Scholar Entry",
          "url": "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=SFLfK9oAAAAJ&citation_for_view=SFLfK9oAAAAJ:qjMakFHDy7sC",
          "type": "website",
          "visibility": "public"
        },
        {
          "label": "BSCS Capstone Project",
          "url": "/projects/ai-diet-exercise-recommendation-system",
          "type": "website",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Presented at 4th IEEE International Conference on Computing & Information Sciences (ICCIS 2021)",
          "note": "Document ID: 9676387, DOI: 10.1109/ICCIS54243.2021.9676387",
          "links": [
            {
              "label": "IEEE Xplore Record",
              "url": "https://ieeexplore.ieee.org/document/9676387",
              "type": "article"
            },
            {
              "label": "Google Scholar Citation",
              "url": "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=SFLfK9oAAAAJ&citation_for_view=SFLfK9oAAAAJ:qjMakFHDy7sC",
              "type": "website"
            }
          ]
        }
      ],
      "featured": True
    }
  ],
  "awards": [
    {
      "id": "award-best-lead",
      "slug": "best-track-lead-qbs",
      "name": "Best Track Lead - QBs co (2024–2025)",
      "organisation": "QBS Co.",
      "date": "2025",
      "period": {
        "startDate": "2024",
        "endDate": "2025"
      },
      "context": "7th Anniversary Celebration & Annual Engineering Excellence Recognition",
      "reason": "Awarded Best Track Lead - QBs co (2024–2025) 'For Leading With Clarity And Purpose' in recognition of high-impact technical leadership, microservices architectural modernization, and engineering delivery.",
      "summary": "Honored as Best Track Lead - QBs co (2024–2025) at QBS Co. 'For Leading With Clarity And Purpose' across distributed systems architecture, microservices modernization, and cloud engineering.",
      "description": "Awarded Best Track Lead - QBs co during the QBS Co. 7th Anniversary Celebration (2024–2025) 'For Leading With Clarity And Purpose'. Recognized for exceptional architectural stewardship, guiding multi-tenant SaaS delivery, decomposing monoliths into containerized microservices on Amazon EKS, and mentoring engineering squads with technical clarity and rigor.",
      "media": [
        {
          "type": "image",
          "url": "/media/awards.jpeg",
          "title": "Best Track Lead - QBs co Trophy (2024–2025)",
          "caption": "Official Best Track Lead - QBs co award trophy presented to Noman Ali by QBS Co. 'For Leading With Clarity And Purpose' (2024–2025).",
          "alt": "Best Track Lead - QBs co award trophy presented to Noman Ali by QBS Co.",
          "ratio": 0.75,
          "visibility": "public"
        }
      ],
      "technologies": [
        "Solutions Architecture",
        "Technical Leadership",
        "Amazon EKS",
        "Microservices",
        "Go",
        ".NET Core"
      ],
      "featured": True
    }
  ],
  "certifications": [
    {
      "id": "cert-piaic-ai",
      "slug": "piaic-certified-ai-developer",
      "name": "Certified Artificial Intelligence Developer",
      "issuer": "Presidential Initiative for Artificial Intelligence & Computing (PIAIC)",
      "issued": "2023-03-20",
      "credentialId": "2023010014199",
      "verificationUrl": "https://www.piaic.org",
      "summary": "Nation-building training program certification in deep learning, neural network architectures, and production AI application development.",
      "description": "Certified as an Artificial Intelligence Developer under the Presidential Initiative for Artificial Intelligence & Computing (PIAIC), a nation-building program initiated by the President of Pakistan. Completed comprehensive training in deep learning, computer vision, natural language processing, and scalable AI engineering under Program Head Zia Khan.",
      "media": [
        {
          "type": "image",
          "url": "/media/certificate-ai-dev-1.png",
          "title": "PIAIC Certified Artificial Intelligence Developer Certificate",
          "caption": "Official certification awarded to Noman Ali by the Presidential Initiative for Artificial Intelligence & Computing (Certificate No. 2023010014199).",
          "alt": "PIAIC Certified Artificial Intelligence Developer certificate for Noman Ali",
          "ratio": 1.204,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Verify at PIAIC",
          "url": "https://www.piaic.org",
          "type": "verification",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "Certified Artificial Intelligence Developer by Presidential Initiative for Artificial Intelligence & Computing",
          "note": "Certificate No. 2023010014199, Issued March 20, 2023",
          "links": [
            {
              "label": "PIAIC Portal",
              "url": "https://www.piaic.org",
              "type": "verification"
            }
          ]
        }
      ],
      "technologies": ["Python", "Deep Learning", "TensorFlow", "PyTorch", "Computer Vision"],
    },
    {
      "id": "cert-hackerrank-cpp",
      "slug": "hackerrank-cpp-intermediate",
      "name": "C++ (Intermediate) Certificate",
      "issuer": "HackerRank",
      "issued": "2020-09-15",
      "credentialId": "1bee3c90b8ee",
      "verificationUrl": "https://www.hackerrank.com/certificates/1bee3c90b8ee",
      "summary": "Verified assessment by HackerRank evaluating intermediate C++ proficiency, memory management, and data structures.",
      "description": "Earned the HackerRank C++ (Intermediate) Skills Certification (ID: 1BEE3C90B8EE) on September 15, 2020. Validates rigorous problem solving in C++, pointer arithmetic, memory management, dynamic polymorphism, and advanced algorithmic implementations.",
      "media": [
        {
          "type": "image",
          "url": "/media/cert-hackerrank-cpp.png",
          "title": "HackerRank C++ (Intermediate) Certificate",
          "caption": "Official HackerRank skills certificate awarded to Noman Ali (Credential ID: 1BEE3C90B8EE, Issued 15 Sep 2020).",
          "alt": "HackerRank C++ Intermediate Certificate for Noman Ali",
          "ratio": 1.91,
          "visibility": "public"
        }
      ],
      "links": [
        {
          "label": "Verify Certificate at HackerRank",
          "url": "https://www.hackerrank.com/certificates/1bee3c90b8ee",
          "type": "verification",
          "visibility": "public"
        }
      ],
      "evidence": [
        {
          "claim": "HackerRank C++ (Intermediate) Skills Certification",
          "note": "Credential ID: 1BEE3C90B8EE, Issued September 15, 2020",
          "links": [
            {
              "label": "HackerRank Verification Record",
              "url": "https://www.hackerrank.com/certificates/1bee3c90b8ee",
              "type": "verification"
            }
          ]
        }
      ],
      "technologies": ["C++", "Data Structures", "Algorithms", "Memory Management", "Object-Oriented Programming"],
      "relatedSkills": ["sk-cpp"]
    }
  ],
  "leadership": [
    {
      "id": "lead-qbs",
      "slug": "technical-leadership-qbs",
      "name": "Technical Leadership & Architectural Governance",
      "organisation": "QBS Co.",
      "period": {
        "startDate": "2024-02-01",
        "ongoing": True
      },
      "scope": "Technical Lead across Core Platform and Microservices",
      "mentoring": "Mentored developers at MIRC (+40% code quality); led technical workshops on Kubernetes, .NET Core, and Go for 25+ interns."
    }
  ],
  "volunteering": [
    {
      "id": "vol-mirc",
      "slug": "mirc-technical-mentor",
      "name": "Developer Mentorship & Technical Training",
      "organisation": "MIRC",
      "period": {
        "startDate": "2023-01-01",
        "endDate": "2024-01-01",
        "ongoing": False
      },
      "role": "Technical Mentor",
      "contribution": "Conducted workshops and 1-on-1 mentoring sessions on containerization, microservice patterns, and distributed debugging.",
      "outcome": "Elevated engineering standards and improved codebase quality by 40% across mentee projects."
    }
  ],
  "languages": [
    {
      "id": "lang-en",
      "slug": "english",
      "name": "English",
      "proficiency": "professional",
      "summary": "Full professional proficiency for engineering architecture, technical writing, and global collaboration.",
      "professionalContext": "Primary working language for technical leadership, distributed systems design, and research publications."
    },
    {
      "id": "lang-ur",
      "slug": "urdu",
      "name": "Urdu",
      "proficiency": "native",
      "summary": "Native proficiency in spoken and written communication.",
      "professionalContext": "Professional and team collaboration, mentorship, and daily operations."
    },
    {
      "id": "lang-sd",
      "slug": "sindhi",
      "name": "Sindhi",
      "proficiency": "native",
      "summary": "Native proficiency in spoken and written communication.",
      "professionalContext": "Native language."
    },
    {
      "id": "lang-ar",
      "slug": "arabic",
      "name": "Arabic",
      "proficiency": "elementary",
      "summary": "Reading proficiency only (script reading and basic textual recognition).",
      "professionalContext": "Reading-only proficiency; can read Arabic script."
    }
  ],
  "startup": {
    "id": "startup-botonetics",
    "slug": "botonetics",
    "name": "Botonetics",
    "logo": "/media/botonetics-logo.svg",
    "status": "coming-soon",
    "vision": "Bridging Brains, Bots, Business",
    "links": [
      {
        "label": "Visit botonetics.com",
        "url": "https://botonetics.com/",
        "type": "website"
      }
    ]
  },
  "future": {
    "statement": "Planning to pursue a PhD in Cyber Security or Neuroevolution and Evolutionary Algorithms.",
    "directions": [
      {
        "id": "dir-phd",
        "label": "PhD in Cyber Security or Neuroevolution & Evolutionary Algorithms",
        "horizon": "planned",
        "detail": "Planning to pursue a PhD in Cyber Security or Neuroevolution and Evolutionary Algorithms.",
        "relatedSkills": [],
        "relatedResearch": []
      }
    ]
  }
}

target_paths = [
    "/home/noman/projects/noman-portfolio/portfolio-os/content/portfolio.json",
    "/home/noman/projects/noman-portfolio/portfolio.json"
]

for p in target_paths:
    with open(p, "w", encoding="utf-8") as f:
        json.dump(portfolio, f, indent=2)
    print(f"Successfully wrote {p}")
