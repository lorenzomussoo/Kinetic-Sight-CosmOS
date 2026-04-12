import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
import re
import os

os.makedirs('test/analysis', exist_ok=True)
log_file = 'test/cosmos_test_results.txt'
log_data = []

with open(log_file, 'r') as f:
    lines = f.readlines()

user_id = 0
for line in lines:
    if 'NEW USER SESSION' in line:
        user_id += 1
    elif 'Task:' in line:
        task_match = re.search(r'task (\w+)', line)
        time_match = re.search(r'Time: ([\d\.]+)s', line)
        pinch_match = re.search(r'Missed Pinches: (\d+)', line)
        voice_match = re.search(r'Voice Fails: (\d+)', line)
        
        if task_match and time_match:
            task = task_match.group(1)
            if task == 'free': task = '3'
            
            log_data.append({
                'User': user_id,
                'Task': f'Task {task}',
                'Time': float(time_match.group(1)),
                'Missed Pinches': int(pinch_match.group(1)) if pinch_match else 0,
                'Voice Fails': int(voice_match.group(1)) if voice_match else 0
            })

df_logs = pd.DataFrame(log_data)
task_means = df_logs.groupby('Task').mean().reset_index()

csv_file = 'test/Kinetic Sight CosmOS: Usability and Workload Evaluation.csv'
df_csv = pd.read_csv(csv_file)

phys_col = [c for c in df_csv.columns if 'physically tiring' in c.lower()][0]
ment_col = [c for c in df_csv.columns if 'mentally demanding' in c.lower()][0]
frust_col = [c for c in df_csv.columns if 'insecure' in c.lower()][0]
scenarios_col = [c for c in df_csv.columns if 'scenarios' in c.lower()][0]

plt.style.use('ggplot')
colors = ['#2C3E50', '#E74C3C', '#3498DB', '#95A5A6']

plt.figure(figsize=(8, 5))
plt.plot(task_means['Task'], task_means['Time'], marker='o', linewidth=3, markersize=8, color=colors[0])
plt.title('Fig 1. Learning Curve: Average Time on Task', fontsize=14, fontweight='bold', pad=15)
plt.ylabel('Time (Seconds)', fontsize=12)
plt.xlabel('Task Progression', fontsize=12)
plt.ylim(0, max(task_means['Time']) + 10)
for i, v in enumerate(task_means['Time']):
    plt.text(i, v + 2, f"{v:.1f}s", ha='center', fontweight='bold')
plt.tight_layout()
plt.savefig('test/analysis/Chart_1_LearningCurve.png', dpi=300)
plt.close()

plt.figure(figsize=(8, 5))
x = np.arange(len(task_means['Task']))
width = 0.35

plt.bar(x - width/2, task_means['Missed Pinches'], width, label='Missed Pinches (Kinetics)', color=colors[2])
plt.bar(x + width/2, task_means['Voice Fails'], width, label='Voice Fails (Speech)', color=colors[1])

plt.title('Fig 2. Multimodal Error Reduction over Time', fontsize=14, fontweight='bold', pad=15)
plt.ylabel('Average Errors per User', fontsize=12)
plt.xticks(x, task_means['Task'])
plt.legend()
plt.tight_layout()
plt.savefig('test/analysis/Chart_2_ErrorReduction.png', dpi=300)
plt.close()

tlx_means = {
    'Physical Demand': df_csv[phys_col].mean(),
    'Mental Demand': df_csv[ment_col].mean(),
    'Frustration': df_csv[frust_col].mean()
}

plt.figure(figsize=(8, 5))
bars = plt.bar(tlx_means.keys(), tlx_means.values(), color=[colors[3], colors[0], colors[1]], width=0.5)
plt.title('Fig 3. NASA-TLX Workload Assessment', fontsize=14, fontweight='bold', pad=15)
plt.ylabel('Score (1 = Very Low, 7 = Very High)', fontsize=12)
plt.ylim(0, 7.5)

for bar in bars:
    yval = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2, yval + 0.2, f"{yval:.1f}/7", ha='center', fontweight='bold')

plt.tight_layout()
plt.savefig('test/analysis/Chart_3_NASATLX.png', dpi=300)
plt.close()

all_scenarios = []
for row in df_csv[scenarios_col].dropna():
    scenarios = str(row).split(';')
    all_scenarios.extend([s.strip() for s in scenarios if s.strip()])

scenario_counts = pd.Series(all_scenarios).value_counts().sort_values(ascending=True)

plt.figure(figsize=(10, 5))
bars = plt.barh(scenario_counts.index, scenario_counts.values, color=colors[2])
plt.title('Fig 4. Preferred Future Scenarios for Kinetic Sight CosmOS', fontsize=14, fontweight='bold', pad=15)
plt.xlabel('Number of Votes', fontsize=12)

for bar in bars:
    plt.text(bar.get_width() + 0.2, bar.get_y() + bar.get_height()/2, 
             f"{int(bar.get_width())}", va='center', fontweight='bold')

plt.tight_layout()
plt.savefig('test/analysis/Chart_4_FutureScenarios.png', dpi=300)
plt.close()

user_errors = df_logs.groupby('User')[['Missed Pinches', 'Voice Fails']].sum().reset_index()
frustration_scores = df_csv[frust_col].values
voice_fails_per_user = user_errors['Voice Fails'].values

plt.figure(figsize=(8, 5))
plt.scatter(voice_fails_per_user, frustration_scores, color=colors[1], s=100, alpha=0.7, edgecolors='black')

z = np.polyfit(voice_fails_per_user, frustration_scores, 1)
p = np.poly1d(z)
plt.plot(voice_fails_per_user, p(voice_fails_per_user), "k--", alpha=0.5, label="Trendline")

plt.title('Fig 5. Triangulation: Voice Fails vs User Frustration', fontsize=14, fontweight='bold', pad=15)
plt.xlabel('Total Voice Fails per User (Logger)', fontsize=12)
plt.ylabel('Reported Frustration (NASA-TLX)', fontsize=12)
plt.ylim(0, 7.5)
plt.legend()
plt.tight_layout()
plt.savefig('test/analysis/Chart_5_Triangulation.png', dpi=300)
plt.close()