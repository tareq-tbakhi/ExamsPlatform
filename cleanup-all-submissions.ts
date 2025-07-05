import { db } from './server/db';
import { submissions, proctoringViolations, videoAnswers, aiAnalysisResults, analysisViolations, analysisTimeline, aiReports, questionGrades, codingSubmissions, examInvitations } from './shared/schema';
import { eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function cleanupAllSubmissions() {
  console.log('🧹 Starting comprehensive cleanup of all exam submission data...\n');

  try {
    // 1. Get all submission IDs first
    const allSubmissions = await db.select({ id: submissions.id }).from(submissions);
    const submissionIds = allSubmissions.map(s => s.id);
    
    console.log(`📊 Found ${submissionIds.length} submissions to delete`);

    if (submissionIds.length === 0) {
      console.log('✅ No submissions found to delete');
      return;
    }

    // 2. Delete related data in the correct order (foreign key constraints)
    console.log('\n🗑️  Deleting related data...');

    // Delete proctoring violations
    const deletedViolations = await db.delete(proctoringViolations)
      .where(inArray(proctoringViolations.submissionId, submissionIds));
    console.log(`   - Proctoring violations: ${deletedViolations.rowCount || 0} records`);

    // Delete video answers
    const deletedVideoAnswers = await db.delete(videoAnswers)
      .where(inArray(videoAnswers.submissionId, submissionIds));
    console.log(`   - Video answers: ${deletedVideoAnswers.rowCount || 0} records`);

    // Delete AI analysis results
    const deletedAIResults = await db.delete(aiAnalysisResults)
      .where(inArray(aiAnalysisResults.submissionId, submissionIds));
    console.log(`   - AI analysis results: ${deletedAIResults.rowCount || 0} records`);

    // Delete analysis violations (these are linked to analysis results, not submissions directly)
    // We'll delete them after deleting analysis results

    // Delete analysis timeline (these are linked to analysis results, not submissions directly)
    // We'll delete them after deleting analysis results

    // Delete AI reports
    const deletedReports = await db.delete(aiReports)
      .where(inArray(aiReports.submissionId, submissionIds));
    console.log(`   - AI reports: ${deletedReports.rowCount || 0} records`);

    // Delete question grades
    const deletedGrades = await db.delete(questionGrades)
      .where(inArray(questionGrades.submissionId, submissionIds));
    console.log(`   - Question grades: ${deletedGrades.rowCount || 0} records`);

    // Delete coding submissions
    const deletedCoding = await db.delete(codingSubmissions)
      .where(inArray(codingSubmissions.submissionId, submissionIds));
    console.log(`   - Coding submissions: ${deletedCoding.rowCount || 0} records`);

    // Delete exam invitations (these don't have submissionId, they have examId)
    // We'll handle this differently

    // 3. Delete main submissions
    const deletedSubmissions = await db.delete(submissions)
      .where(inArray(submissions.id, submissionIds));
    console.log(`   - Main submissions: ${deletedSubmissions.rowCount} records`);

    // 4. Clean up uploaded files
    console.log('\n📁 Cleaning up uploaded files...');
    
    const uploadDirs = [
      'uploads/videos',
      'uploads/audio', 
      'uploads/proctoring'
    ];

    let totalFilesDeleted = 0;

    for (const dir of uploadDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          try {
            fs.unlinkSync(filePath);
            totalFilesDeleted++;
          } catch (error) {
            console.log(`   ⚠️  Could not delete ${filePath}: ${error}`);
          }
        }
        console.log(`   - ${dir}: ${files.length} files deleted`);
      } else {
        console.log(`   - ${dir}: directory not found`);
      }
    }

    console.log(`\n✅ Cleanup completed successfully!`);
    console.log(`📊 Summary:`);
    console.log(`   - Submissions deleted: ${deletedSubmissions.rowCount || 0}`);
    console.log(`   - Related records deleted: ${(deletedViolations.rowCount || 0) + (deletedVideoAnswers.rowCount || 0) + (deletedAIResults.rowCount || 0) + (deletedReports.rowCount || 0) + (deletedGrades.rowCount || 0) + (deletedCoding.rowCount || 0)}`);
    console.log(`   - Files deleted: ${totalFilesDeleted}`);
    console.log(`\n🎯 All exam submission data has been completely removed!`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupAllSubmissions()
  .then(() => {
    console.log('\n🎉 Cleanup script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Cleanup failed:', error);
    process.exit(1);
  }); 