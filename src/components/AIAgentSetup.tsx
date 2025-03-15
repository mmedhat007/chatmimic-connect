import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../services/firebase';
import { createUserTable, saveUserConfig } from '../services/supabase';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import NavSidebar from '../components/NavSidebar';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox';
  options?: string[];
  required: boolean;
}

type QuestionValue = string | string[];

const questions: { [key: string]: Question[] } = {
  company_info: [
    {
      id: 'business_name',
      text: 'What is your business name?',
      type: 'text',
      required: true
    },
    {
      id: 'industry',
      text: 'What industry are you in?',
      type: 'text',
      required: true
    },
    {
      id: 'locations',
      text: 'Where are your business locations? (comma-separated)',
      type: 'text',
      required: true
    },
    {
      id: 'differentiators',
      text: 'What are your key differentiators from competitors?',
      type: 'textarea',
      required: true
    }
  ],
  roles: [
    {
      id: 'primary_roles',
      text: 'What are the primary roles you want the AI agent to handle?',
      type: 'checkbox',
      options: ['Answer FAQs', 'Forward Leads', 'Handle Complaints', 'Process Orders', 'Provide Support'],
      required: true
    },
    {
      id: 'role_priority',
      text: 'How would you prioritize these roles? (1 being highest)',
      type: 'text',
      required: true
    }
  ],
  communication_style: [
    {
      id: 'tone',
      text: 'What tone should the AI agent use?',
      type: 'radio',
      options: ['Formal', 'Professional', 'Casual', 'Friendly'],
      required: true
    },
    {
      id: 'emoji_usage',
      text: 'Should the AI agent use emojis?',
      type: 'radio',
      options: ['Yes', 'No', 'Sparingly'],
      required: true
    },
    {
      id: 'response_length',
      text: 'Preferred response length:',
      type: 'radio',
      options: ['Concise', 'Moderate', 'Detailed'],
      required: true
    }
  ],
  scenarios: [
    {
      id: 'common_scenarios',
      text: 'What are the most common scenarios the AI agent should handle?',
      type: 'textarea',
      required: true
    },
    {
      id: 'scenario_responses',
      text: 'How should the AI agent respond to these scenarios?',
      type: 'textarea',
      required: true
    }
  ],
  knowledge_base: [
    {
      id: 'faq_url',
      text: 'Do you have a FAQ document or knowledge base URL?',
      type: 'text',
      required: false
    },
    {
      id: 'product_catalog',
      text: 'Do you have a product catalog URL?',
      type: 'text',
      required: false
    }
  ],
  compliance_rules: [
    {
      id: 'disclaimers',
      text: 'Are there any disclaimers or compliance requirements?',
      type: 'textarea',
      required: false
    },
    {
      id: 'forbidden_words',
      text: 'Are there any forbidden words or phrases? (comma-separated)',
      type: 'text',
      required: false
    }
  ]
};

const AIAgentSetup = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentSection, setCurrentSection] = useState('company_info');
  const [answers, setAnswers] = useState<{ [key: string]: { [key: string]: QuestionValue } }>({});
  const [isLoading, setIsLoading] = useState(false);

  const sections = Object.keys(questions);
  const currentIndex = sections.indexOf(currentSection);

  const handleInputChange = (questionId: string, value: QuestionValue) => {
    setAnswers(prev => ({
      ...prev,
      [currentSection]: {
        ...prev[currentSection],
        [questionId]: value
      }
    }));
  };

  const handleNext = async () => {
    // Validate current section
    const currentQuestions = questions[currentSection];
    const currentAnswers = answers[currentSection] || {};
    
    const missingRequired = currentQuestions.filter(q => 
      q.required && !currentAnswers[q.id]
    );

    if (missingRequired.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: "Please fill in all required fields before continuing.",
        variant: "destructive"
      });
      return;
    }

    if (currentIndex === sections.length - 1) {
      // This is the last section, save everything
      await handleSubmit();
    } else {
      // Move to next section
      setCurrentSection(sections[currentIndex + 1]);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentSection(sections[currentIndex - 1]);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    const userUID = getCurrentUser();
    
    if (!userUID) {
      toast({
        title: "Error",
        description: "No user logged in",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create user table in Supabase
      await createUserTable(userUID);

      // Save configuration
      await saveUserConfig(userUID, {
        company_info: answers.company_info,
        roles: answers.roles,
        communication_style: answers.communication_style,
        scenarios: answers.scenarios,
        knowledge_base: answers.knowledge_base,
        compliance_rules: answers.compliance_rules,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Update Firebase to mark setup as completed
      const userRef = doc(db, 'Users', userUID);
      await updateDoc(userRef, {
        'workflows.whatsapp_agent.setup_completed': true
      });

      toast({
        title: "Success",
        description: "AI agent configuration saved successfully!",
      });

      // Navigate to WhatsApp dashboard
      navigate('/');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderQuestion = (question: Question) => {
    const value = answers[currentSection]?.[question.id] || '';

    switch (question.type) {
      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder={`Enter your answer${question.required ? ' (required)' : ''}`}
            className="mt-2"
          />
        );
      case 'radio':
        return (
          <div className="mt-2 space-y-2">
            {question.options?.map((option) => (
              <label key={option} className="flex items-center space-x-2">
                <input
                  type="radio"
                  value={option}
                  checked={value === option}
                  onChange={(e) => handleInputChange(question.id, e.target.value)}
                  className="w-4 h-4"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      case 'checkbox':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="mt-2 space-y-2">
            {question.options?.map((option) => (
              <label key={option} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  value={option}
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    const currentValues = [...selectedValues];
                    if (e.target.checked) {
                      currentValues.push(option);
                    } else {
                      const index = currentValues.indexOf(option);
                      if (index > -1) {
                        currentValues.splice(index, 1);
                      }
                    }
                    handleInputChange(question.id, currentValues);
                  }}
                  className="w-4 h-4"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );
      default:
        return (
          <Input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(question.id, e.target.value)}
            placeholder={`Enter your answer${question.required ? ' (required)' : ''}`}
            className="mt-2"
          />
        );
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <NavSidebar />
      <div className="flex-1 ml-16 p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 capitalize">
                {currentSection.replace('_', ' ')}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Step {currentIndex + 1} of {sections.length}
              </p>
            </div>

            <div className="space-y-6">
              {questions[currentSection].map((question) => (
                <div key={question.id}>
                  <label className="block text-sm font-medium text-gray-700">
                    {question.text}
                    {question.required && <span className="text-red-500">*</span>}
                  </label>
                  {renderQuestion(question)}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-between">
              <Button
                onClick={handleBack}
                disabled={currentIndex === 0 || isLoading}
                variant="outline"
              >
                Back
              </Button>
              <Button
                onClick={handleNext}
                disabled={isLoading}
              >
                {currentIndex === sections.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AIAgentSetup; 