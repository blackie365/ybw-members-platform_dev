import { DailyNewsEmail } from "@/components/emails/daily-news-email";

// Sample news stories for preview
// The first story should be the featured article from the home page
const sampleStories = [
{
  id: "1",
  title: "Yorkshire Tech Hub Secures Record Investment for Women-Led Startups",
  slug: "yorkshire-tech-hub-investment",
  custom_excerpt:
  "A groundbreaking initiative has launched in Leeds, providing unprecedented funding opportunities for female entrepreneurs in the technology sector. The programme aims to address the persistent gender gap in venture capital.",
  feature_image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_14311f073-1769255714055.png",
  published_at: new Date()?.toISOString(),
  reading_time: 5,
  featured: true,
  primary_tag: { name: "News", slug: "news" },
  primary_author: { name: "Sarah Mitchell" }
},
{
  id: "2",
  title: "Breaking Barriers: How Local Leaders Are Reshaping Corporate Culture",
  slug: "breaking-barriers-corporate-culture",
  custom_excerpt:
  "New research reveals that Yorkshire businesses with diverse leadership teams outperform their peers by 25%.",
  feature_image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_1b8899a97-1768389747850.png",
  published_at: new Date()?.toISOString(),
  reading_time: 4,
  primary_tag: { name: "News", slug: "news" },
  primary_author: { name: "Emma Thompson" }
},
{
  id: "3",
  title: "The Future of Flexible Working: What Yorkshire Employers Need to Know",
  slug: "future-flexible-working",
  custom_excerpt:
  "As hybrid work becomes the norm, local businesses are pioneering innovative approaches to workplace flexibility.",
  feature_image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_1305bb57c-1767686695108.png",
  published_at: new Date()?.toISOString(),
  reading_time: 3,
  primary_tag: { name: "News", slug: "news" },
  primary_author: { name: "Rachel Hughes" }
},
{
  id: "4",
  title: "From Side Hustle to Success: The Rise of Yorkshire's E-Commerce Queens",
  slug: "ecommerce-success-stories",
  custom_excerpt:
  "Meet the women turning their passion projects into thriving online businesses.",
  feature_image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_1ed51c71d-1767863687373.png",
  published_at: new Date()?.toISOString(),
  reading_time: 6,
  primary_tag: { name: "News", slug: "news" },
  primary_author: { name: "Kate Williams" }
},
{
  id: "5",
  title: "Networking in the Digital Age: Building Meaningful Business Connections",
  slug: "networking-digital-age",
  custom_excerpt:
  "Expert strategies for expanding your professional network in an increasingly virtual world.",
  feature_image:
  "https://img.rocket.new/generatedImages/rocket_gen_img_16274a2cf-1772192095312.png",
  published_at: new Date()?.toISOString(),
  reading_time: 4,
  primary_tag: { name: "News", slug: "news" },
  primary_author: { name: "Lucy Davies" }
}];


export default function DailyNewsEmailPreview() {
  return (
    <div className="min-h-screen bg-stone-100">
      <div className="mx-auto max-w-4xl py-8 px-4">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl font-medium text-stone-900 mb-2">
            Daily News Newsletter Template
          </h1>
          <p className="text-stone-600">
            Preview of the daily newsletter featuring the home page&apos;s featured article plus 4 latest news stories
          </p>
        </div>

        <div className="rounded-lg shadow-xl overflow-hidden">
          <DailyNewsEmail
            stories={sampleStories}
            recipientName="Jane"
            editorNote="This week we're celebrating the incredible achievements of women across Yorkshire's business landscape. From tech innovation to retail revolution, these stories showcase the diverse talents shaping our regional economy."
            date={new Date()} />
          
        </div>
      </div>
    </div>);

}