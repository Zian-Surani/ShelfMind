import pypdf

reader = pypdf.PdfReader('ShelfMind_Project_Report.pdf')
print('Total pages in PDF:', len(reader.pages))

targets = [
    ('c1', 'Chapter 1: Introduction'),
    ('c11', '1.1 Retail Inventory Paradigm'),
    ('c12', '1.2 The Operational Dilemma'),
    ('c13', '1.3 Computer Vision Integration'),
    ('c14', '1.4 Scope and Report Organization'),
    ('c2', 'Chapter 2: Literature Review'),
    ('c21', '2.1 Classical Inventory Theory'),
    ('c22', '2.2 Dynamic Programming and Stochastic'),
    ('c23', '2.3 Markov Decision Processes in Operations'),
    ('c24', '2.4 Deep Reinforcement Learning in Supply Chains'),
    ('c25', '2.5 Computer Vision for Planogram Auditing'),
    ('c26', '2.6 Guardrailed Autonomy'),
    ('c3', 'Chapter 3: Problem Statement & Objectives'),
    ('c31', '3.1 Problem Statement'),
    ('c32', '3.2 Operational Friction'),
    ('c33', '3.3 Research and Engineering Objectives'),
    ('c4', 'Chapter 4: System Analysis and Requirements'),
    ('c41', '4.1 Stakeholder Analysis'),
    ('c42', '4.2 Functional Requirements'),
    ('c43', '4.3 Non-Functional Requirements'),
    ('c44', '4.4 Hardware and Software Requirements'),
    ('c5', 'Chapter 5: Methodology / System Design'),
    ('c51', '5.1 Formal Markov Decision Process'),
    ('c52', '5.2 Dynamic Programming: Value Iteration'),
    ('c53', '5.3 Model-Free RL Extensions'),
    ('c54', '5.4 Computer Vision Subsystem'),
    ('c55', '5.5 Guardrail Governance'),
    ('c6', 'Chapter 6: Implementation'),
    ('c61', '6.1 High-Level Architectural Pipeline'),
    ('c62', '6.2 Backend Architecture'),
    ('c63', '6.3 Computer Vision & Edge Inference Service'),
    ('c64', '6.4 Frontend Decision Cockpit'),
    ('c7', 'Chapter 7: Results and Discussion'),
    ('c71', '7.1 Algorithmic Convergence'),
    ('c72', '7.2 Optimal Policy Interpretability'),
    ('c73', '7.3 Retail Dataset Backtest'),
    ('c74', '7.4 Vision Detector Reliability'),
    ('c8', 'Chapter 8: Testing'),
    ('c81', '8.1 Testing Philosophy'),
    ('c82', '8.2 Algorithmic Correctness'),
    ('c83', '8.3 Vision Pipeline & Quality Assurance Validation'),
    ('c84', '8.4 Comprehensive Test Suite Matrix'),
    ('c9', 'Chapter 9: Conclusion and Future Work'),
    ('c91', '9.1 Summary of Contributions'),
    ('c92', '9.2 Operational Takeaways'),
    ('c93', '9.3 Limitations and Roadblocks'),
    ('c94', '9.4 Roadmap for Future Extensions'),
    ('ref', 'References')
]

page_map = {}
for code, phrase in targets:
    for page_idx, page in enumerate(reader.pages):
        # Skip page 2 which is the TOC itself
        if page_idx == 1:
            continue
        text = page.extract_text()
        if phrase.lower() in text.lower():
            page_map[code] = str(page_idx + 1)
            break

print('Discovered Page Mapping:')
print('{')
for k, v in page_map.items():
    print(f'    "{k}": "{v}",')
print('}')
