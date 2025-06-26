import { useParams } from "wouter";
import StudentExam from "@/components/student-exam";

export default function TakeExam() {
  const { examId } = useParams<{ examId: string }>();

  if (!examId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Exam Link</h1>
          <p className="text-gray-600">The exam link you followed is not valid.</p>
        </div>
      </div>
    );
  }

  return <StudentExam examId={parseInt(examId)} />;
}
