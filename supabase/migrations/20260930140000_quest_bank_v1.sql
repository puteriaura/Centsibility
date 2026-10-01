-- 20260930140000_quest_bank_v1.sql
-- Wave G Task 1 (T26): Starter quest bank with 24 age-based quests (8 per group).
-- Rollback:
--   delete from public.quests where slug in (
--     'coins-and-notes', 'count-it-up', 'save-or-spend', 'needs-and-wants',
--     'my-first-tabung', 'sharing-is-caring', 'smart-shopper', 'keep-money-safe',
--     'budget-basics', 'percent-power', 'price-detective', 'goal-planner',
--     'what-are-fees', 'earning-money', 'giving-wisely', 'online-smart',
--     'interest-explained', 'inflation', 'cost-of-borrowing', 'credit-basics',
--     'investing-101', 'scam-spotter', 'side-income', 'money-plan'
--   );

-- ---------------------------------------------------------------------------
-- Quests Seeding
-- ---------------------------------------------------------------------------

insert into public.quests (slug, age_group, position, title, summary, icon, points, active)
values
  -- 6-9: Little Savers (300 points)
  ('coins-and-notes', '6-9', 1, 'Coins and Notes', 'Learn how ringgit and sen work together.', 'coins', 300, true),
  ('count-it-up', '6-9', 2, 'Count It Up', 'Add small amounts of money for everyday treats.', 'calculator', 300, true),
  ('save-or-spend', '6-9', 3, 'Save or Spend', 'Discover why keeping money for later helps you.', 'wallet', 300, true),
  ('needs-and-wants', '6-9', 4, 'Needs and Wants', 'Spot things you must have versus things that are nice to have.', 'compass', 300, true),
  ('my-first-tabung', '6-9', 5, 'My First Tabung', 'Set a saving target and build patience.', 'piggy', 300, true),
  ('sharing-is-caring', '6-9', 6, 'Sharing is Caring', 'Learn how sadaqah brings joy to others.', 'heart', 300, true),
  ('smart-shopper', '6-9', 7, 'Smart Shopper', 'Compare prices and check your change at the shop.', 'cart', 300, true),
  ('keep-money-safe', '6-9', 8, 'Keep Money Safe', 'Protect your secret PIN and keep your savings safe.', 'shield', 300, true),

  -- 10-12: Smart Savers (400 points)
  ('budget-basics', '10-12', 1, 'Budget Basics', 'Split your pocket money into save, spend, and give.', 'wallet', 400, true),
  ('percent-power', '10-12', 2, 'Percent Power', 'Work out discounts and percentages when shopping.', 'calculator', 400, true),
  ('price-detective', '10-12', 3, 'Price Detective', 'Find the best value per item before buying.', 'search', 400, true),
  ('goal-planner', '10-12', 4, 'Goal Planner', 'Calculate how many weeks you need to reach a savings target.', 'target', 400, true),
  ('what-are-fees', '10-12', 5, 'What Are Fees?', 'Understand service charges and hidden costs on receipts.', 'receipt', 400, true),
  ('earning-money', '10-12', 6, 'Earning Money', 'Discover honest ways to earn pocket money and build skills.', 'briefcase', 400, true),
  ('giving-wisely', '10-12', 7, 'Giving Wisely', 'Plan regular sadaqah and learn what zakat means in Islam.', 'heart', 400, true),
  ('online-smart', '10-12', 8, 'Online Smart', 'Stay safe with online purchases, games, and passwords.', 'lock', 400, true),

  -- 13-17: Money Pros (500 points)
  ('interest-explained', '13-17', 1, 'Interest Explained', 'Understand conventional interest and why Islamic finance avoids riba.', 'scale', 500, true),
  ('inflation', '13-17', 2, 'Inflation and Prices', 'See how rising prices affect your purchasing power over time.', 'trend', 500, true),
  ('cost-of-borrowing', '13-17', 3, 'Cost of Borrowing', 'Compare borrowing costs and discover benevolent Qard Hasan loans.', 'receipt', 500, true),
  ('credit-basics', '13-17', 4, 'Credit Basics', 'Learn about credit, on-time payments, and avoiding debt traps.', 'card', 500, true),
  ('investing-101', '13-17', 5, 'Investing 101', 'Learn about risk, return, long-term growth, and Shariah screening.', 'chart', 500, true),
  ('scam-spotter', '13-17', 6, 'Scam Spotter', 'Identify online scams, fake investments, and illegal mule accounts.', 'shield', 500, true),
  ('side-income', '13-17', 7, 'Side Income and Records', 'Manage side hustles, track income, and save for taxes.', 'briefcase', 500, true),
  ('money-plan', '13-17', 8, 'Master Money Plan', 'Build an emergency fund, monthly budget, and personal financial plan.', 'compass', 500, true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Questions Seeding Helper
-- ---------------------------------------------------------------------------

do $$
declare
  v_qid uuid;
begin
  -- =========================================================================
  -- 6-9: Little Savers (3 choices per question, 8 quests x 3 = 24 questions)
  -- Answer positions balanced: 8 at 0, 8 at 1, 8 at 2
  -- =========================================================================

  -- Quest 1: coins-and-notes
  select id into v_qid from public.quests where slug = 'coins-and-notes';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'How many 10 sen coins make RM1.00?', '["10 coins", "5 coins", "20 coins"]'::jsonb, 0, 'There are 100 sen in RM1. Ten 10 sen coins add up to 100 sen.'),
      (v_qid, 2, 'What color is the Malaysian RM1 banknote?', '["Green", "Blue", "Red"]'::jsonb, 1, 'The Malaysian RM1 note is blue and features the wau bulan kite on the back.'),
      (v_qid, 3, 'If you have two 50 sen coins, how much do you have in total?', '["50 sen", "RM2.00", "RM1.00"]'::jsonb, 2, '50 sen plus 50 sen equals 100 sen, which is exactly RM1.00.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 2: count-it-up
  select id into v_qid from public.quests where slug = 'count-it-up';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'You buy a curry puff for RM1.50 and a juice box for RM1.50. How much is that altogether?', '["RM3.00", "RM2.50", "RM4.00"]'::jsonb, 0, 'RM1.50 plus RM1.50 makes RM3.00.'),
      (v_qid, 2, 'You have RM5.00 and spend RM2.00 on a notebook. How much change do you get?', '["RM2.00", "RM3.00", "RM4.00"]'::jsonb, 1, 'Taking away RM2.00 from RM5.00 leaves you with RM3.00.'),
      (v_qid, 3, 'Which of these is worth the most money?', '["Three RM1 notes", "Four 50 sen coins", "One RM5 note"]'::jsonb, 2, 'One RM5 note is worth RM5, while three RM1 notes are RM3 and four 50 sen coins are RM2.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 3: save-or-spend
  select id into v_qid from public.quests where slug = 'save-or-spend';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What does saving money mean?', '["Keeping some money safe for later", "Spending all your money today", "Losing your money in the playground"]'::jsonb, 0, 'Saving means keeping some of your money so you can use it in the future.'),
      (v_qid, 2, 'If you get RM4 pocket money every day, what is a smart habit?', '["Spend all RM4 immediately", "Save RM1 and spend RM3", "Throw the coins away"]'::jsonb, 1, 'Putting aside a small part like RM1 each day helps you build healthy savings.'),
      (v_qid, 3, 'Why is it good to have savings?', '["So you never have to go to school", "So your wallet becomes very heavy", "So you can buy important things when you need them"]'::jsonb, 2, 'Savings give you money for bigger goals or unexpected needs.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 4: needs-and-wants
  select id into v_qid from public.quests where slug = 'needs-and-wants';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'Which of these is a need for school?', '["School shoes", "Video games", "Candy"]'::jsonb, 0, 'School shoes protect your feet and are required for school. Toys and candy are wants.'),
      (v_qid, 2, 'What is a want?', '["A healthy lunch", "A third toy robot", "Drinking water when thirsty"]'::jsonb, 1, 'A want is something fun to have, but you can live healthily without it.'),
      (v_qid, 3, 'When you have limited pocket money, what should you buy first?', '["Your wants first", "Whatever looks brightest", "Your needs first"]'::jsonb, 2, 'Always take care of essential needs before spending money on wants.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 5: my-first-tabung
  select id into v_qid from public.quests where slug = 'my-first-tabung';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is a Tabung used for?', '["Holding your savings for a goal", "Storing old pencils", "A toy to throw"]'::jsonb, 0, 'A Tabung is a special box or digital pot where you keep money for your targets.'),
      (v_qid, 2, 'You want a storybook that costs RM15. You save RM3 every week. How many weeks will it take?', '["3 weeks", "5 weeks", "10 weeks"]'::jsonb, 1, 'RM15 divided by RM3 per week equals 5 weeks of patient saving.'),
      (v_qid, 3, 'What should you do when you are tempted to empty your Tabung for sweets?', '["Empty it immediately", "Hide it from everyone", "Remind yourself of your big goal"]'::jsonb, 2, 'Remembering what you are saving for helps you stay patient and reach your goal.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 6: sharing-is-caring
  select id into v_qid from public.quests where slug = 'sharing-is-caring';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is sadaqah in Islam?', '["A voluntary gift given with kindness", "A loan you must pay back", "A fee you pay for shopping"]'::jsonb, 0, 'Sadaqah is giving voluntarily to help others and earn blessings from Allah.'),
      (v_qid, 2, 'Can you give sadaqah even if you only have 50 sen to spare?', '["No, you must have RM100", "Yes, even small gifts count", "Only adults can give"]'::jsonb, 1, 'Every good deed and small coin given with a pure heart counts as sadaqah.'),
      (v_qid, 3, 'How does giving sadaqah make people feel?', '["Angry and upset", "Tired and sleepy", "Happy and cared for"]'::jsonb, 2, 'Helping people in need brings joy to both the giver and the receiver.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 7: smart-shopper
  select id into v_qid from public.quests where slug = 'smart-shopper';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'Shop A sells an eraser for RM1.00. Shop B sells the same eraser for RM1.50. Which is better value?', '["Shop A", "Shop B", "Both are identical in price"]'::jsonb, 0, 'Shop A offers the exact same item for 50 sen less, saving you money.'),
      (v_qid, 2, 'What should you do right after a shopkeeper hands you change?', '["Put it away without looking", "Count it to make sure it is correct", "Drop it on the floor"]'::jsonb, 1, 'Checking your change immediately ensures any counting mistakes are sorted out politely on the spot.'),
      (v_qid, 3, 'Before going to the pasar malam, what helps you not overspend?', '["Carrying all your savings", "Running to every stall", "Making a shopping list with a parent"]'::jsonb, 2, 'A list helps you buy what you planned and keep your spending under control.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 8: keep-money-safe
  select id into v_qid from public.quests where slug = 'keep-money-safe';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'Where should you keep physical cash when you go to school?', '["In your pocket or secure bag pocket", "On top of your desk unattended", "In your hand while running"]'::jsonb, 0, 'Keeping cash in a zipped pocket or pouch prevents it from falling out or being lost.'),
      (v_qid, 2, 'Who should know your secret 6-digit account PIN?', '["Your friends at school", "Only you and your parent", "Anyone who asks nicely"]'::jsonb, 1, 'Your PIN is a private secret to protect your money. Only you and your parents should know it.'),
      (v_qid, 3, 'What should you do if someone at school asks for your password or PIN?', '["Tell them right away", "Write it on their notebook", "Say no and tell your parent or teacher"]'::jsonb, 2, 'Never share your security codes with anyone outside your parents.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- =========================================================================
  -- 10-12: Smart Savers (4 choices per question, 8 quests x 3 = 24 questions)
  -- Answer positions balanced: 6 at 0, 6 at 1, 6 at 2, 6 at 3
  -- =========================================================================

  -- Quest 1: budget-basics (0, 1, 2)
  select id into v_qid from public.quests where slug = 'budget-basics';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is a budget?', '["A plan for how you will spend, save, and give your money", "A list of things you want to buy online", "A special type of bank account for businesses", "A store receipt that shows total taxes"]'::jsonb, 0, 'A budget is a personal plan that guides how you divide and use your money wisely.'),
      (v_qid, 2, 'If you receive RM20 allowance and follow a 50/30/20 rule for spend, save, and give, how much do you save?', '["RM4", "RM6", "RM10", "RM12"]'::jsonb, 1, '30 percent of RM20 is 0.30 times 20, which equals RM6 saved.'),
      (v_qid, 3, 'Why is giving sadaqah included in a balanced budget?', '["Because schools require donations every term", "Because banks deduct charity fees automatically", "Because sharing wealth is an essential Islamic financial value", "Because giving makes your total balance increase instantly"]'::jsonb, 2, 'Including charity in your budget trains you to share blessings and help your community consistently.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 2: percent-power (3, 0, 1)
  select id into v_qid from public.quests where slug = 'percent-power';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What does 100 percent of an amount mean?', '["None of it", "Half of it", "Twice as much", "The entire full amount"]'::jsonb, 3, '100 percent represents the whole or complete total.'),
      (v_qid, 2, 'A pencil case costs RM10. The shop offers a 10 percent discount. How much is the discount?', '["RM1.00", "RM0.50", "RM2.00", "RM5.00"]'::jsonb, 0, '10 percent of RM10 is 0.10 times 10, which equals RM1.00 off.'),
      (v_qid, 3, 'A school bag original price is RM60. It is on a 50 percent off sale. What is the new price?', '["RM20", "RM30", "RM40", "RM50"]'::jsonb, 1, '50 percent off means half price. Half of RM60 is RM30.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 3: price-detective (2, 3, 0)
  select id into v_qid from public.quests where slug = 'price-detective';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'If 1 kilogram of apples costs RM8, how much does 500 grams cost?', '["RM2", "RM6", "RM4", "RM8"]'::jsonb, 2, '500 grams is half a kilogram, so it costs half of RM8, which is RM4.'),
      (v_qid, 2, 'Is a bigger package always cheaper per gram than a smaller package?', '["Yes, bigger packages are always the best value", "Only when buying imported goods", "Only during festive holiday sales", "No, you must check unit price to be sure"]'::jsonb, 3, 'Marketers sometimes price bigger packs higher. Always check the price per unit or gram.'),
      (v_qid, 3, 'A pack of 2 pens costs RM4.00. A pack of 5 pens costs RM15.00. Which has the lower price per pen?', '["The pack of 2 pens", "The pack of 5 pens", "Both have the same unit price", "It depends on the color of the ink"]'::jsonb, 0, 'Pack of 2 is RM2.00 per pen, while pack of 5 is RM3.00 per pen. The 2-pack is cheaper per pen.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 4: goal-planner (1, 2, 3)
  select id into v_qid from public.quests where slug = 'goal-planner';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'You want to save RM80 for a badminton racket. If you save RM10 every week, how many weeks does it take?', '["6 weeks", "8 weeks", "10 weeks", "12 weeks"]'::jsonb, 1, 'RM80 divided by RM10 per week equals 8 weeks.'),
      (v_qid, 2, 'What should you do if an unexpected school expense slows down your Tabung progress?', '["Give up on your savings goal completely", "Borrow money from friends without asking parents", "Adjust your timeline and keep saving steadily", "Spend the rest of your savings immediately"]'::jsonb, 2, 'Financial plans can adjust when needs arise. Stay calm and continue steadily towards your goal.'),
      (v_qid, 3, 'Why does writing down a specific savings target help you reach it?', '["It makes stores reduce their prices", "It adds points to your account automatically", "It prevents prices from rising with inflation", "It makes the goal clear and easy to track"]'::jsonb, 3, 'Clear targets help you monitor your progress and stay motivated over time.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 5: what-are-fees (0, 1, 2)
  select id into v_qid from public.quests where slug = 'what-are-fees';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is a service fee on a food delivery order?', '["A fee paid for the work of delivering and preparing the food", "A government penalty for ordering late at night", "A refundable deposit that you get back next week", "An optional tip that the restaurant owner pays you"]'::jsonb, 0, 'Service fees cover the operational cost of processing and fulfilling services.'),
      (v_qid, 2, 'Why is checking the receipt after paying a good habit?', '["Because receipts are required to enter the shop again", "To verify that prices and fees match what you agreed to pay", "Because stores charge an extra fee if you lose the paper", "To make sure the cashier did not forget your phone number"]'::jsonb, 1, 'Receipts allow you to confirm accuracy and spot accidental overcharges.'),
      (v_qid, 3, 'An online shirt shows RM25, but delivery is RM6 and platform fee is RM1. What is the total cost?', '["RM25", "RM31", "RM32", "RM35"]'::jsonb, 2, 'RM25 plus RM6 plus RM1 equals RM32 total cost. Always check the final checkout total.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 6: earning-money (3, 0, 1)
  select id into v_qid from public.quests where slug = 'earning-money';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'When you earn money from selling handmade crafts, what should you do with the income?', '["Spend everything immediately on snacks", "Give all the money away and stop making crafts", "Assume all revenue is pure profit", "Record your costs and save a portion of the profit"]'::jsonb, 3, 'Tracking costs and saving profits teaches you essential entrepreneurship skills.'),
      (v_qid, 2, 'What is the difference between earning money and receiving duit raya?', '["Earning comes from your effort and work; duit raya is a kind gift", "There is no financial difference at all", "Duit raya must always be repaid to your relatives", "Earning money is only allowed for registered companies"]'::jsonb, 0, 'Earning comes from providing value or work, while gifts are given freely without work required.'),
      (v_qid, 3, 'Which of these is an honest way for a young person to earn pocket money at home?', '["Borrowing money from siblings without permission", "Helping wash the family car or tidying the storeroom", "Charging family members to talk to them", "Selling household items online without asking"]'::jsonb, 1, 'Earning through helpful chores agreed with your parents builds strong character and work ethic.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 7: giving-wisely (2, 3, 0)
  select id into v_qid from public.quests where slug = 'giving-wisely';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'If you want to support a charitable cause, what is a wise first step?', '["Send money to an unknown profile on social media", "Transfer money quickly before asking anyone", "Discuss the charity with your parents to ensure it is verified", "Borrow money so you can donate a bigger amount"]'::jsonb, 2, 'Verifying reputable causes with parents ensures your charity safely reaches real beneficiaries.'),
      (v_qid, 2, 'Who receives assistance through zakat in an Islamic community?', '["Anyone who wants to buy luxury gadgets", "Commercial companies and store chains", "Private sports clubs and gaming teams", "Specific groups in need like the poor, destitute, and debtors"]'::jsonb, 3, 'Zakat is specifically distributed to designated groups mentioned in the Quran, including the poor and needy.'),
      (v_qid, 3, 'What is the key difference between Zakat and Sadaqah?', '["Zakat is obligatory for eligible Muslims; Sadaqah is voluntary", "Sadaqah is only for adults; Zakat is for children", "Zakat can only be given in food; Sadaqah in cash", "Zakat and Sadaqah have identical rules in Islamic law"]'::jsonb, 0, 'Zakat is one of the five pillars of Islam with specific rules, while Sadaqah is voluntary charity.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 8: online-smart (1, 2, 3)
  select id into v_qid from public.quests where slug = 'online-smart';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What makes a strong, safe password for your digital accounts?', '["Your birth year or your pet name", "A mix of words, numbers, and symbols kept private", "The word password followed by 123", "Your school registration number"]'::jsonb, 1, 'Strong passwords protect your private accounts from unauthorised access.'),
      (v_qid, 2, 'Why are in-game micro-transactions risky if you do not track them?', '["They cause games to delete your high score", "They make the game stop updating", "Small RM2 or RM5 purchases add up quickly to large totals", "They convert real ringgit into unusable foreign currency"]'::jsonb, 2, 'Small digital charges feel invisible, but dozens of small purchases can drain savings fast.'),
      (v_qid, 3, 'A mobile game asks for your debit card PIN for free in-game diamonds. What should you do?', '["Enter the PIN quickly before the offer expires", "Share your PIN in a private chat with a friend", "Create a fake PIN and hope the game accepts it", "Never share your PIN and tell your parent immediately"]'::jsonb, 3, 'Legitimate games never ask for your private banking PIN. This is a phishing scam.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- =========================================================================
  -- 13-17: Money Pros (4 choices per question, 8 quests x 4 = 32 questions)
  -- 4 questions per quest: includes 1 real calculation question per quest
  -- Answer positions balanced: 8 at 0, 8 at 1, 8 at 2, 8 at 3
  -- =========================================================================

  -- Quest 1: interest-explained (0, 1, 2, 3)
  select id into v_qid from public.quests where slug = 'interest-explained';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'Why does Islamic banking avoid interest (riba)?', '["Because charging excess money on money without sharing real risk is prohibited", "Because Islamic banks do not operate with paper currency", "Because Islamic finance prohibits all trade and commerce", "Because banks only offer barter exchanges"]'::jsonb, 0, 'Islamic finance is based on real economic activity, asset backing, and ethical risk sharing rather than interest.'),
      (v_qid, 2, 'In conventional finance, what is interest on a loan?', '["A voluntary tip paid at the borrower discretion", "An extra charge paid to the lender for borrowing money over time", "A government subsidy provided to lower loan balances", "A discount offered to borrowers who repay early"]'::jsonb, 1, 'Conventional interest is a predetermined extra charge based on the loaned amount and time.'),
      (v_qid, 3, 'What is the role of an Islamic banking structure like Murabahah or Ijarah?', '["They are informal arrangements with no written contracts", "They waive all repayment obligations for students", "They structure financing through transparent trade sales or leasing of assets", "They convert loans into lottery tickets"]'::jsonb, 2, 'Murabahah is cost-plus sale trade, and Ijarah is asset leasing. Both connect financing directly to tangible economic assets.'),
      (v_qid, 4, 'If someone borrows RM500 under a conventional loan with simple interest at 5% per year, how much total interest is owed after 2 years?', '["RM25.00", "RM52.50", "RM100.00", "RM50.00"]'::jsonb, 3, 'Simple interest is calculated as Principal times Rate times Time. RM500 times 0.05 times 2 equals RM50.00 in interest.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 2: inflation (1, 2, 3, 0)
  select id into v_qid from public.quests where slug = 'inflation';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'If a bowl of noodles cost RM4 ten years ago and costs RM8 today, what happened to purchasing power?', '["Purchasing power doubled over the decade", "Purchasing power decreased because RM4 buys less food today", "Purchasing power stayed identical because money is fixed", "Purchasing power only matters for foreign currencies"]'::jsonb, 1, 'When prices rise, each unit of currency buys a smaller quantity of goods than before.'),
      (v_qid, 2, 'Why do people look for halal investments or Growth Tabung to beat inflation?', '["Because investments always guarantee double returns every year", "Because bank savings accounts are closed after five years", "Because keeping cash uninvested loses purchasing power over decades", "Because government regulations require all savings to be invested"]'::jsonb, 2, 'Growing savings at a rate higher than inflation preserves your future purchasing power.'),
      (v_qid, 3, 'What is inflation?', '["A sudden increase in the physical size of paper banknotes", "A decrease in the total number of commercial bank branches", "A temporary discount offered during shopping festive seasons", "A general rise in prices reducing what your money can buy"]'::jsonb, 3, 'Inflation means the average cost of goods and services rises, so RM10 buys less over time.'),
      (v_qid, 4, 'If inflation averages 3% per year, approximately how much will a basket of groceries that costs RM100 today cost after 2 years?', '["RM106.09", "RM103.00", "RM106.00", "RM109.27"]'::jsonb, 0, 'In year 1, the cost becomes RM100 times 1.03 equals RM103.00. In year 2, RM103.00 times 1.03 equals RM106.09. Compounding inflation increases prices each year.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 3: cost-of-borrowing (2, 3, 0, 1)
  select id into v_qid from public.quests where slug = 'cost-of-borrowing';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'If someone borrows RM1,000 and the lender demands RM1,200 back next month, what is the extra RM200 in conventional terms?', '["A tax deduction from the government", "A refundable security deposit", "Interest or financing charge", "A routine postal delivery fee"]'::jsonb, 2, 'The extra RM200 is a borrowing cost, representing a 20 percent charge on the loan.'),
      (v_qid, 2, 'What is a major danger of taking on multiple loans without a repayment plan?', '["Your credit score improves automatically", "Banks forgive student loans after twelve months", "You receive free shopping reward points", "Accumulating debt and penalties can trap you in severe financial stress"]'::jsonb, 3, 'Borrowing more than you can comfortably repay leads to severe debt stress and damaged credit history.'),
      (v_qid, 3, 'What is Qard Hasan in Islamic ethics?', '["A benevolent, interest-free loan to assist someone in genuine need", "A speculative investment in high-risk stock markets", "A late payment penalty charged by credit providers", "A commercial partnership where profits are guaranteed"]'::jsonb, 0, 'Qard Hasan is an ethical interest-free loan where the borrower repays only the principal amount borrowed.'),
      (v_qid, 4, 'You buy a tablet using an installment plan of 3 monthly payments of RM150. If you miss one payment deadline and incur a RM25 late penalty fee, what is your total cost?', '["RM450.00", "RM475.00", "RM465.00", "RM500.00"]'::jsonb, 1, 'Three regular installments of RM150 equal RM450.00. Adding the RM25.00 penalty fee makes the total paid RM475.00.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 4: credit-basics (3, 0, 1, 2)
  select id into v_qid from public.quests where slug = 'credit-basics';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'Why is maintaining a clean payment history important as you become an adult?', '["It increases your mobile phone storage capacity", "It allows you to bypass paying utility bills", "It qualifies you for discount airline tickets automatically", "It affects your ability to rent a home, get financing, or start a business"]'::jsonb, 3, 'Credit and payment records demonstrate trustworthiness to financial institutions and landlords.'),
      (v_qid, 2, 'How does a debit card differ from a credit card?', '["A debit card spends money already in your account; a credit card borrows from a bank limit", "A debit card charges daily compounding interest while credit cards do not", "Debit cards can only be used at automated teller machines", "Credit cards require no repayment if used for groceries"]'::jsonb, 0, 'Debit cards draw directly from your existing savings balance, preventing accidental debt.'),
      (v_qid, 3, 'What is Buy Now Pay Later (BNPL)?', '["A government grant designed for teenage students", "A financing service that splits purchases into installments that must be repaid", "A promotional gift program with no payments required", "A store loyalty card that offers free merchandise"]'::jsonb, 1, 'BNPL is short-term credit. Missing payment deadlines triggers penalty fees and harms your credit track record.'),
      (v_qid, 4, 'A Buy Now Pay Later (BNPL) service splits a RM240 purchase into 3 equal monthly payments. How much is each monthly installment?', '["RM60.00", "RM70.00", "RM80.00", "RM90.00"]'::jsonb, 2, 'RM240 divided by 3 equal installments equals RM80.00 per month.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 5: investing-101 (0, 1, 2, 3)
  select id into v_qid from public.quests where slug = 'investing-101';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is the relationship between risk and potential return in investing?', '["Higher potential returns usually involve higher potential risk of loss", "Low-risk investments always produce the highest returns", "Legitimate investing has zero risk of capital loss", "Risk and return have no relationship in financial markets"]'::jsonb, 0, 'In real financial markets, higher potential gains carry greater risk of fluctuations and losses.'),
      (v_qid, 2, 'Can any legitimate halal investment guarantee a fixed 50 percent return every month?', '["Yes, top online traders achieve this easily with algorithms", "No, genuine investments have market risk and cannot promise guaranteed sky-high profits", "Yes, as long as the scheme is endorsed by popular influencers", "Only if the contract is signed in person at an office"]'::jsonb, 1, 'Guaranteed high returns are classic hallmarks of financial fraud and Ponzi schemes.'),
      (v_qid, 3, 'What does Shariah screening for investments involve?', '["Ensuring companies operate only within a single state or city", "Requiring companies to donate 100 percent of their revenue to charity", "Checking that companies do not engage in gambling, alcohol, conventional riba finance, or harmful trades", "Checking that corporate logos use approved brand colors"]'::jsonb, 2, 'Shariah screening filters out businesses involved in unethical activities, high debt, or prohibited industries.'),
      (v_qid, 4, 'You allocate RM400 into a halal Growth Tabung. Over one year, the investment yields a profit return of 6%. How much profit have you gained?', '["RM16.00", "RM20.00", "RM28.00", "RM24.00"]'::jsonb, 3, 'Profit equals RM400 times 0.06, which equals RM24.00 in profit gain for the year.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 6: scam-spotter (1, 2, 3, 0)
  select id into v_qid from public.quests where slug = 'scam-spotter';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What should you do if an online stranger pressures you to send cryptocurrency or funds urgently?', '["Send a small test amount to see if they are trustworthy", "Stop communication, block them, and report to parents or authorities", "Ask your classmates to lend you money to pay them", "Send personal identification documents instead of money"]'::jsonb, 1, 'Urgency and pressure tactics are primary indicators of fraud. Seek trusted adult guidance immediately.'),
      (v_qid, 2, 'Someone on social media offers you RM200 to let them use your bank account for a few transfers. What is this?', '["A standard peer-to-peer student banking service", "A harmless way to earn pocket money during holidays", "An illegal mule account scam that can lead to criminal prosecution and account blacklisting", "A government-sponsored youth employment initiative"]'::jsonb, 2, 'Renting or sharing your bank account turns you into a money mule for criminals, which is a serious crime under Malaysian law.'),
      (v_qid, 3, 'You receive an SMS with a link saying your bank account is suspended and demanding your password. What is this?', '["An official update from the central banking authority", "A routine software maintenance check by your mobile network", "A verified security alert that requires immediate login", "A phishing scam trying to steal your account credentials"]'::jsonb, 3, 'Banks never send links asking for your passwords or OTPs via SMS. Never click suspicious links.'),
      (v_qid, 4, 'A suspicious online scheme promises a guaranteed return of 10% every month. If someone foolishly believes this simple monthly rate, what annual rate are they claiming?', '["120% per year", "60% per year", "100% per year", "240% per year"]'::jsonb, 0, 'Ten percent per month multiplied by 12 months equals 120% per year without even compounding. No genuine, regulated investment can guarantee such returns.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 7: side-income (2, 3, 0, 1)
  select id into v_qid from public.quests where slug = 'side-income';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'When your side income grows, what is a sound financial practice?', '["Spend all earnings immediately to keep zero balance", "Stop keeping receipts and financial records", "Set aside portions for saving, operational reinvestment, and charity", "Take out commercial bank loans to cover living costs"]'::jsonb, 2, 'Allocating earnings across savings, business growth, and sadaqah establishes lifelong financial discipline.'),
      (v_qid, 2, 'Why is keeping a simple ledger of your sales and expenses valuable?', '["It guarantees that your side venture cannot lose money", "It allows you to sell products without charging customers", "It replaces the need to open any formal bank account", "It lets you see whether your side venture is truly making money"]'::jsonb, 3, 'Accurate financial records give you clarity on cash flow and help you price services sustainably.'),
      (v_qid, 3, 'If you earn money tutoring younger students or selling baked goods, what is gross income versus net profit?', '["Gross is total revenue received; net profit is revenue minus all your material costs", "Gross and net profit are always identical figures", "Gross is money you donate; net profit is money you borrow", "Gross is only measured at the end of each calendar decade"]'::jsonb, 0, 'Profit equals total sales minus your actual expenses such as baking ingredients or study materials.'),
      (v_qid, 4, 'You bake and sell cookies. You spend RM30 on ingredients and packaging, and you sell all the cookies for a total revenue of RM50. What is your profit margin?', '["20%", "40%", "50%", "60%"]'::jsonb, 1, 'Your profit is RM50 minus RM30 equals RM20. Profit margin is profit divided by revenue: RM20 divided by RM50 equals 0.40, or 40%.')
    on conflict (quest_id, position) do nothing;
  end if;

  -- Quest 8: money-plan (3, 0, 1, 2)
  select id into v_qid from public.quests where slug = 'money-plan';
  if v_qid is not null then
    insert into public.quest_questions (quest_id, position, prompt, choices, correct_index, explanation) values
      (v_qid, 1, 'What is the purpose of an emergency fund?', '["To fund expensive holiday trips and shopping sprees", "To speculate on volatile foreign exchange markets", "To avoid needing any health or property insurance", "To cover unexpected urgent expenses without going into debt"]'::jsonb, 3, 'An emergency fund provides a financial safety cushion when unexpected needs or repairs arise.'),
      (v_qid, 2, 'How often should a person review their budget, savings goals, and spending habits?', '["Regularly, such as every month or quarter", "Only when their bank balance drops to zero", "Once every five to ten years", "Never, budgets should remain permanent and unchanged"]'::jsonb, 0, 'Monthly reviews help you adjust your spending to align with your changing goals and needs.'),
      (v_qid, 3, 'What are the three pillars of a wholesome personal financial plan?', '["Borrowing maximum credit, impulsive shopping, and hiding receipts", "Disciplined saving, ethical spending, and consistent charitable giving", "Relying on lottery tickets, quick investment schemes, and debt", "Only keeping physical cash stored at home"]'::jsonb, 1, 'Balancing savings, mindful spending, and charitable contributions creates enduring barakah and financial well-being.'),
      (v_qid, 4, 'Your basic monthly living expenses are RM300. You want to build a 3-month emergency fund. If you can save RM75 each month, how many months will it take to complete the fund?', '["6 months", "9 months", "12 months", "15 months"]'::jsonb, 2, 'A 3-month emergency fund requires 3 times RM300 equals RM900. Saving RM75 per month means RM900 divided by RM75 equals 12 months.')
    on conflict (quest_id, position) do nothing;
  end if;

end $$;
