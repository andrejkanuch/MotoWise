// @ts-nocheck — @react-pdf/renderer is ESM-only; this file is dynamically imported at runtime
/**
 * React PDF template for Bike Health Reports.
 *
 * Uses @react-pdf/renderer to generate a PDF buffer.
 * Install the package before using: pnpm --filter api add @react-pdf/renderer
 *
 * This is a basic structure — styling can be refined later.
 */

import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1a1a1a',
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#e54d2e',
    paddingBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#e54d2e',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  label: {
    color: '#666',
    width: '40%',
  },
  value: {
    fontWeight: 'bold',
    width: '60%',
    textAlign: 'right',
  },
  taskRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  taskTitle: {
    width: '50%',
  },
  taskStatus: {
    width: '25%',
    textAlign: 'center',
  },
  taskPriority: {
    width: '25%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 9,
    color: '#999',
  },
});

export interface MaintenanceTaskData {
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  completedAt?: string;
}

export interface BikeData {
  make: string;
  model: string;
  year: number;
  nickname?: string;
  currentMileage?: number;
  mileageUnit?: string;
}

export interface ReportData {
  bike: BikeData;
  tasks: MaintenanceTaskData[];
  generatedAt: string;
  totalExpenses?: number;
  currency?: string;
}

export function ReportTemplate({ data }: { data: ReportData }) {
  const completedTasks = data.tasks.filter((t) => t.status === 'completed');
  const pendingTasks = data.tasks.filter((t) => t.status !== 'completed');
  const bikeName = data.bike.nickname
    ? `${data.bike.nickname} (${data.bike.year} ${data.bike.make} ${data.bike.model})`
    : `${data.bike.year} ${data.bike.make} ${data.bike.model}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Bike Health Report</Text>
          <Text style={styles.subtitle}>{bikeName}</Text>
          <Text style={styles.subtitle}>
            Generated {new Date(data.generatedAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Total Maintenance Tasks</Text>
            <Text style={styles.value}>{data.tasks.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Completed</Text>
            <Text style={styles.value}>{completedTasks.length}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Pending / In Progress</Text>
            <Text style={styles.value}>{pendingTasks.length}</Text>
          </View>
          {data.bike.currentMileage != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Current Mileage</Text>
              <Text style={styles.value}>
                {data.bike.currentMileage.toLocaleString()} {data.bike.mileageUnit ?? 'mi'}
              </Text>
            </View>
          )}
          {data.totalExpenses != null && (
            <View style={styles.row}>
              <Text style={styles.label}>Total Expenses</Text>
              <Text style={styles.value}>
                {data.currency ?? '$'}
                {data.totalExpenses.toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {pendingTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Tasks</Text>
            <View style={styles.taskRow}>
              <Text style={[styles.taskTitle, { fontWeight: 'bold' }]}>Task</Text>
              <Text style={[styles.taskStatus, { fontWeight: 'bold' }]}>Status</Text>
              <Text style={[styles.taskPriority, { fontWeight: 'bold' }]}>Priority</Text>
            </View>
            {pendingTasks.map((task, _i) => (
              <View key={task.title} style={styles.taskRow}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskStatus}>{task.status}</Text>
                <Text style={styles.taskPriority}>{task.priority}</Text>
              </View>
            ))}
          </View>
        )}

        {completedTasks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed Tasks</Text>
            <View style={styles.taskRow}>
              <Text style={[styles.taskTitle, { fontWeight: 'bold' }]}>Task</Text>
              <Text style={[styles.taskStatus, { fontWeight: 'bold' }]}>Completed</Text>
              <Text style={[styles.taskPriority, { fontWeight: 'bold' }]}>Priority</Text>
            </View>
            {completedTasks.map((task, _i) => (
              <View key={task.title} style={styles.taskRow}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskStatus}>
                  {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : 'Done'}
                </Text>
                <Text style={styles.taskPriority}>{task.priority}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>MotoVault — Bike Health Report — Confidential</Text>
      </Page>
    </Document>
  );
}
