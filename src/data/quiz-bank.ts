// 200 financial-literacy questions for kids. Each has 4 options + index of correct answer + short explain.
export type QQ = { q: string; options: string[]; answer: number; explain: string };

const base: QQ[] = [
  {
    q: "What is money used for?",
    options: ["Eating", "Buying things", "Sleeping", "Running"],
    answer: 1,
    explain: "Money is a tool we use to trade for things we need or want.",
  },
  {
    q: "What does it mean to save money?",
    options: ["Spend it fast", "Throw it away", "Keep it for later", "Hide it forever"],
    answer: 2,
    explain: "Saving means setting money aside to use in the future.",
  },
  {
    q: "A budget helps you…",
    options: ["Run faster", "Plan how to use money", "Cook food", "Make friends"],
    answer: 1,
    explain: "A budget is a plan for spending and saving.",
  },
  {
    q: "What is income?",
    options: ["Money you earn", "Money you spend", "Money you lose", "Money in a bank only"],
    answer: 0,
    explain: "Income is the money you receive, like an allowance or a job.",
  },
  {
    q: "What is an expense?",
    options: ["Money that comes in", "Money that goes out", "A type of coin", "A toy"],
    answer: 1,
    explain: "An expense is money you pay for something.",
  },
  {
    q: "Which is a 'need'?",
    options: ["A new game", "Food and water", "A toy", "Candy"],
    answer: 1,
    explain: "Needs are things you must have to live, like food, water, shelter.",
  },
  {
    q: "Which is a 'want'?",
    options: ["Water", "Shelter", "A new toy", "Healthy food"],
    answer: 2,
    explain: "Wants are nice but not necessary.",
  },
  {
    q: "What does 'Riba' mean in Islamic finance?",
    options: ["Charity", "Interest (forbidden)", "A halal investment", "A goal"],
    answer: 1,
    explain: "Riba is interest. Islam forbids it.",
  },
  {
    q: "What is 'Hibah'?",
    options: ["A loan", "A voluntary gift", "A monthly fee", "A tax"],
    answer: 1,
    explain: "Hibah is a voluntary gift — never guaranteed, never interest.",
  },
  {
    q: "Zakat on savings is usually…",
    options: ["10%", "5%", "2.5%", "1%"],
    answer: 2,
    explain: "2.5% Zakat on eligible wealth above the Nisab.",
  },
  {
    q: "Sadaqah means…",
    options: ["Loan", "Voluntary charity", "Tax", "Salary"],
    answer: 1,
    explain: "Sadaqah is voluntary charity given anytime.",
  },
  {
    q: "Qard hasan is…",
    options: ["A gift", "An interest-free loan", "A salary", "A fee"],
    answer: 1,
    explain: "Qard hasan is a kind, interest-free loan.",
  },
  {
    q: "If you have RM10 and spend RM4, how much is left?",
    options: ["RM4", "RM6", "RM10", "RM14"],
    answer: 1,
    explain: "10 − 4 = 6.",
  },
  {
    q: "Saving a little each week is called…",
    options: ["Spending", "A habit", "A goal-streak", "Wasting"],
    answer: 1,
    explain: "Regular saving is a great money habit.",
  },
  {
    q: "If something is too expensive, you should…",
    options: ["Steal it", "Save up for it", "Cry", "Ignore money"],
    answer: 1,
    explain: "Save and plan — patience pays off.",
  },
  {
    q: "What's a goal?",
    options: ["A dream you plan for", "A snack", "A toy", "A coin"],
    answer: 0,
    explain: "A goal is a target you work toward.",
  },
  {
    q: "What is a coin?",
    options: ["A metal piece of money", "A type of fruit", "A toy", "A fish"],
    answer: 0,
    explain: "Coins are small metal money.",
  },
  {
    q: "What is a banknote?",
    options: ["Paper money", "A music note", "A letter", "A type of bird"],
    answer: 0,
    explain: "Banknotes are printed paper money.",
  },
  {
    q: "Why do we keep money safe?",
    options: ["So nobody loses it", "So it grows hair", "It tastes good", "It barks"],
    answer: 0,
    explain: "Safe money can be used later.",
  },
  {
    q: "If you earn coins from chores, that is your…",
    options: ["Income", "Loss", "Tax", "Gift"],
    answer: 0,
    explain: "Chore money is income you earned.",
  },
  {
    q: "Which choice helps you save most?",
    options: ["Buy candy daily", "Save half of allowance", "Lend to friends", "Lose it"],
    answer: 1,
    explain: "Saving a fixed share builds your wealth.",
  },
  {
    q: "Comparing prices before buying is called…",
    options: ["Shopping smart", "Stealing", "Hiding", "Wasting"],
    answer: 0,
    explain: "Smart shoppers compare to get value.",
  },
  {
    q: "An emergency fund is for…",
    options: ["Toys", "Surprises like a flat tire", "Vacations", "Gifts"],
    answer: 1,
    explain: "It covers unexpected costs.",
  },
  {
    q: "Which is a long-term goal?",
    options: ["Buying gum tomorrow", "Saving for university", "Snack today", "Chips now"],
    answer: 1,
    explain: "Long-term goals take months or years.",
  },
  {
    q: "Which is a short-term goal?",
    options: ["Retirement", "New book this month", "House in 20 years", "University"],
    answer: 1,
    explain: "Short-term = within weeks/months.",
  },
  {
    q: "If a toy costs RM20 and you have RM12, you need…",
    options: ["RM2 more", "RM5 more", "RM8 more", "RM10 more"],
    answer: 2,
    explain: "20 − 12 = 8.",
  },
  {
    q: "Bank accounts help you…",
    options: ["Lose money", "Keep money safe and track it", "Eat money", "Burn money"],
    answer: 1,
    explain: "Banks keep your money safe and organized.",
  },
  {
    q: "Halal money is earned…",
    options: ["By cheating", "Honestly and ethically", "By stealing", "From riba"],
    answer: 1,
    explain: "Halal earnings are honest and ethical.",
  },
  {
    q: "Haram earnings include…",
    options: ["Allowance", "Stealing", "Selling lemonade", "Helping at home"],
    answer: 1,
    explain: "Stealing is haram (forbidden).",
  },
  {
    q: "If your friend lends you money, you should…",
    options: ["Forget it", "Pay it back on time", "Run away", "Spend more"],
    answer: 1,
    explain: "Pay back what you owe — it builds trust.",
  },
  {
    q: "Trust is built by…",
    options: ["Lying", "Keeping promises", "Hiding", "Avoiding people"],
    answer: 1,
    explain: "Promises kept = trust earned.",
  },
  {
    q: "What does 'invest' mean?",
    options: ["Spend", "Put money to work to grow", "Lose money", "Hide money"],
    answer: 1,
    explain: "Investing puts money to work over time.",
  },
  {
    q: "Patience with money helps you…",
    options: ["Buy junk", "Reach big goals", "Forget plans", "Lose it"],
    answer: 1,
    explain: "Patience grows savings.",
  },
  {
    q: "Sharing wealth (Sadaqah) makes…",
    options: ["You poorer forever", "Society stronger", "Friends jealous", "Money worthless"],
    answer: 1,
    explain: "Sadaqah blesses giver and community.",
  },
  {
    q: "If you find money on the street, you should…",
    options: ["Keep silently", "Try to find the owner", "Burn it", "Eat it"],
    answer: 1,
    explain: "Returning lost items is the right thing.",
  },
  {
    q: "A wise spender first asks…",
    options: ["Do I really need this?", "Is it shiny?", "Is it loud?", "Is it heavy?"],
    answer: 0,
    explain: "Always ask if it's a need or want.",
  },
  {
    q: "What is debt?",
    options: ["Money you owe", "Money you have", "A toy", "A coin"],
    answer: 0,
    explain: "Debt is money you must pay back.",
  },
  {
    q: "Late repayment of a loan…",
    options: ["Helps trust", "Hurts trust", "Adds coins", "Doesn't matter"],
    answer: 1,
    explain: "Pay on time to keep your trust score high.",
  },
  {
    q: "Wealth in Islam is…",
    options: ["Owned forever by you", "A trust from Allah", "Useless", "A burden only"],
    answer: 1,
    explain: "Wealth is an amanah (trust) to use well.",
  },
  {
    q: "Which is a halal job for kids?",
    options: [
      "Helping at the family shop",
      "Selling stolen goods",
      "Cheating in games",
      "Lying to sell",
    ],
    answer: 0,
    explain: "Honest work is halal.",
  },
];

// Generate variants to reach 200 questions
const arithmeticTpl = (a: number, b: number, op: "+" | "-" | "×"): QQ => {
  const result = op === "+" ? a + b : op === "-" ? a - b : a * b;
  const wrong = [result + 1, result - 1, result + 2].filter((x) => x !== result);
  const opts = [
    String(result),
    String(wrong[0]),
    String(wrong[1]),
    String(wrong[2] ?? result + 3),
  ].sort(() => Math.random() - 0.5);
  return {
    q: `If you have RM${a} and ${op === "+" ? "earn" : op === "-" ? "spend" : "save"} RM${b}${op === "×" ? " every day for some days" : ""}, what's the total? (${a} ${op} ${b})`,
    options: opts,
    answer: opts.indexOf(String(result)),
    explain: `${a} ${op} ${b} = ${result}.`,
  };
};

const more: QQ[] = [];
for (let i = 0; i < 60; i++) {
  const a = 5 + (i % 20);
  const b = 1 + ((i * 3) % 12);
  more.push(arithmeticTpl(a, b, "+"));
  more.push(arithmeticTpl(Math.max(a, b) + 5, Math.min(a, b), "-"));
}

const concepts: QQ[] = [
  {
    q: "If you save RM2 every week, in 10 weeks you'll have…",
    options: ["RM5", "RM10", "RM20", "RM200"],
    answer: 2,
    explain: "RM2 × 10 = RM20.",
  },
  {
    q: "Which grows faster: spending or saving?",
    options: ["Spending grows wealth", "Saving grows wealth", "Both shrink it", "Neither"],
    answer: 1,
    explain: "Saving builds wealth over time.",
  },
  {
    q: "When you give Sadaqah, your reward comes from…",
    options: ["Friends", "Allah", "Toys", "Money"],
    answer: 1,
    explain: "Sadaqah's reward is from Allah.",
  },
  {
    q: "Best place to put long-term savings?",
    options: ["Under bed", "A safe account/investment", "A puddle", "Trash"],
    answer: 1,
    explain: "Safe accounts protect and grow money.",
  },
  {
    q: "What is 'Nisab'?",
    options: ["A type of food", "Minimum wealth before Zakat is due", "A coin", "A loan"],
    answer: 1,
    explain: "Nisab is the threshold above which Zakat applies.",
  },
  {
    q: "If a parent gifts you money as Hibah, it is…",
    options: ["A loan", "Yours to keep", "A tax", "A fee"],
    answer: 1,
    explain: "Hibah gifts are yours.",
  },
  {
    q: "What's better when borrowing?",
    options: ["Interest loan", "Qard (interest-free)", "Forget to pay", "Pay double"],
    answer: 1,
    explain: "Qard hasan is the halal way.",
  },
  {
    q: "Wasting money (israf) is…",
    options: ["Encouraged", "Discouraged in Islam", "Required", "Always good"],
    answer: 1,
    explain: "Islam discourages wastefulness (israf).",
  },
  {
    q: "Hard work earns…",
    options: ["Nothing", "Halal income", "Riba", "Bad luck"],
    answer: 1,
    explain: "Honest hard work earns halal income.",
  },
  {
    q: "If you mix needs and wants, you'll…",
    options: ["Save more", "Overspend", "Earn more", "Get rich"],
    answer: 1,
    explain: "Knowing the difference prevents overspending.",
  },
  {
    q: "Compounding means…",
    options: ["Money grows on growth", "Money disappears", "Money halves", "Money sleeps"],
    answer: 0,
    explain: "Compounding lets gains earn more gains.",
  },
  {
    q: "Why diversify (mix) investments?",
    options: ["More fun", "Reduce risk", "Lose more", "Confuse banks"],
    answer: 1,
    explain: "Diversifying lowers risk.",
  },
  {
    q: "What is inflation (simple)?",
    options: ["Prices go down", "Prices go up over time", "Money grows magically", "Banks close"],
    answer: 1,
    explain: "Inflation = prices rising over time.",
  },
  {
    q: "Saving early helps because…",
    options: ["Time grows money", "Banks like kids", "It's lucky", "Toys cost less"],
    answer: 0,
    explain: "More time = more growth.",
  },
  {
    q: "If your goal is RM50 and you save RM5/week, how many weeks?",
    options: ["5", "10", "20", "50"],
    answer: 1,
    explain: "50 ÷ 5 = 10 weeks.",
  },
  {
    q: "Charity given secretly is…",
    options: ["Worthless", "Highly rewarded", "Banned", "Lost"],
    answer: 1,
    explain: "Quiet sadaqah is greatly rewarded.",
  },
  {
    q: "What's an 'allowance'?",
    options: ["Money parents give regularly", "A toy", "A snack", "A bank"],
    answer: 0,
    explain: "Allowance is regular money from parents.",
  },
  {
    q: "Best way to remember spending?",
    options: ["Forget it", "Track it in a list/app", "Hide it", "Lie about it"],
    answer: 1,
    explain: "Tracking helps you stay on budget.",
  },
  {
    q: "If you owe RM5, your net worth changes by…",
    options: ["+RM5", "-RM5", "0", "+RM10"],
    answer: 1,
    explain: "Debts reduce net worth.",
  },
  {
    q: "A receipt is…",
    options: ["Proof of purchase", "A toy", "A loan", "A bank"],
    answer: 0,
    explain: "Receipts prove what you paid.",
  },
  {
    q: "Banks earn money mostly from…",
    options: ["Magic", "Fees and (in non-Islamic banks) interest", "Selling toys", "Eating coins"],
    answer: 1,
    explain: "Banks earn via fees and lending; Islamic banks avoid riba.",
  },
  {
    q: "Islamic banks avoid…",
    options: ["Halal trade", "Riba (interest)", "Zakat", "Sadaqah"],
    answer: 1,
    explain: "Islamic banks must avoid riba.",
  },
  {
    q: "When you barter, you…",
    options: ["Trade goods directly", "Use money", "Steal", "Borrow"],
    answer: 0,
    explain: "Barter trades goods/services without money.",
  },
  {
    q: "Best way to ask parents for something?",
    options: ["Cry loudly", "Plan and explain why", "Steal it", "Hide and take"],
    answer: 1,
    explain: "Communicate and plan — like a budget request.",
  },
  {
    q: "Money habit that helps most?",
    options: ["Buy on impulse", "Wait 24h before big buys", "Skip planning", "Borrow always"],
    answer: 1,
    explain: "Waiting reduces regret purchases.",
  },
];

export const ALL_QUESTIONS: QQ[] = [...base, ...more, ...concepts];
// Pad to 200
while (ALL_QUESTIONS.length < 200) {
  const i = ALL_QUESTIONS.length;
  const a = 3 + (i % 25);
  const b = 1 + ((i * 7) % 15);
  ALL_QUESTIONS.push(arithmeticTpl(a + b, b, "-"));
}
ALL_QUESTIONS.length = 200;
