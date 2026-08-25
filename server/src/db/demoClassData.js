/**
 * demoClassData.js — content for the presentation dataset.
 *
 * A class of ten students sitting six of the teacher's exams. Separate from
 * seedData.js because that dataset is the *fixture* the tests and the e2e
 * script rely on; this one exists to give the analytics screens something
 * substantial to show, and is loaded additively by seedDemoClass.js without
 * truncating anything.
 *
 * Each question carries a `difficulty` on a logit scale, roughly -1.5 (nearly
 * everyone gets it) to +0.5 (only the strongest do). It drives the simulated
 * answers, which is what makes "hardest question" in the analytics a real
 * finding rather than noise.
 */

/** Password shared by every seeded student, as in seedData.js. */
export const CLASS_PASSWORD = 'password';

/** Domain used to recognise this dataset's students on a re-run. */
export const CLASS_DOMAIN = 'class.ems.dev';

export const students = [
  { key: 's01', name: 'Noa Shapira',    email: 'noa.shapira@class.ems.dev' },
  { key: 's02', name: 'Itay Ben-Ami',   email: 'itay.benami@class.ems.dev' },
  { key: 's03', name: 'Shira Mizrahi',  email: 'shira.mizrahi@class.ems.dev' },
  { key: 's04', name: 'Adam Peretz',    email: 'adam.peretz@class.ems.dev' },
  { key: 's05', name: 'Yael Avrahami',  email: 'yael.avrahami@class.ems.dev' },
  { key: 's06', name: 'Roi Katz',       email: 'roi.katz@class.ems.dev' },
  { key: 's07', name: 'Lior Dahan',     email: 'lior.dahan@class.ems.dev' },
  { key: 's08', name: 'Tamar Segal',    email: 'tamar.segal@class.ems.dev' },
  { key: 's09', name: 'Eitan Malka',    email: 'eitan.malka@class.ems.dev' },
  { key: 's10', name: 'Hila Barkat',    email: 'hila.barkat@class.ems.dev' },
];

/**
 * Difficulties and model answers for the exam the teacher already created by
 * hand, matched by question position. Its rows are left exactly as they are —
 * only submissions are added.
 */
export const existingExam = {
  title: 'Python Fundamentals Exam',
  difficulty: [-1.2, -0.3, -0.9, -0.4, -1.0],
  openAnswers: {
    1: {
      strong:
        'def sum_even(numbers):\n    total = 0\n    for n in numbers:\n        if n % 2 == 0:\n            total += n\n    return total\n\n' +
        'It walks the list once, so it is O(n). n % 2 == 0 is the even test. An empty list returns 0, ' +
        'which is the correct identity for a sum. The same thing as a comprehension would be ' +
        'sum(n for n in numbers if n % 2 == 0).',
      mid:
        'def sum_even(numbers):\n    total = 0\n    for n in numbers:\n        if n % 2 == 0:\n            total += n\n    return total\n\n' +
        'Loops over the list and adds up the even ones.',
      weak:
        'def sum_even(numbers):\n    for n in numbers:\n        if n % 2 == 0:\n            return n\n\n' +
        'This checks if the numbers are even.',
    },
  },
};

export const exams = [
  {
    key: 'js',
    title: 'JavaScript Essentials',
    description:
      'Core language semantics: types, scope, equality, array methods and asynchronous functions.',
    durationMinutes: 60,
    passingGrade: 60,
    status: 'Published',
    daysAgo: 47,
    questions: [
      { type: 'multiple-choice', weight: 10, difficulty: -1.2,
        text: 'What does typeof null evaluate to in JavaScript?',
        options: ['"null"', '"object"', '"undefined"', '"number"'], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.7,
        text: 'What does declaring a variable with const prevent?',
        options: [
          'Mutating the object the variable points to',
          'Reassigning the binding to a different value',
          'Using the variable anywhere outside a function',
          'Passing the variable to another function',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: -0.5,
        text: 'Explain the difference between == and === in JavaScript, and give one example where the two produce different results.',
        answers: {
          strong:
            '=== is strict equality: it compares type and value, and returns false immediately if the types differ. ' +
            '== is loose equality: it coerces the operands to a common type first, then compares. ' +
            "Example: 0 == '' is true because the empty string is coerced to the number 0, while 0 === '' is false " +
            'because a number and a string are different types. Another classic is null == undefined (true) versus ' +
            'null === undefined (false). Prefer === so that comparisons never depend on the coercion table.',
          mid:
            '=== checks the value and the type, == only checks the value after converting the types. ' +
            "For example '5' == 5 is true but '5' === 5 is false because one is a string and one is a number. " +
            'It is safer to use === most of the time.',
          weak:
            '== is equal and === is really equal. === is stricter so you should use it. ' +
            "For example 5 == '5' is true.",
        } },
      { type: 'multiple-choice', weight: 10, difficulty: -1.3,
        text: 'What does [1, 2, 3].map(x => x * 2) return?',
        options: ['[1, 2, 3]', '[2, 4, 6]', '6', 'undefined'], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.3,
        text: 'Which statement best describes a closure?',
        options: [
          'A function that calls itself until a base case is reached',
          'A function together with the scope it was created in, which it keeps access to',
          'A function that takes no parameters and returns no value',
          'A function stored as a property of an object',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.4,
        text: 'What does an async function always return?',
        options: ['The resolved value directly', 'A Promise', 'undefined', 'A callback function'],
        correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.9,
        text: 'What does [1, 2, 3, 4].filter(x => x % 2 === 0) return?',
        options: ['[1, 3]', '[2, 4]', 'true', '2'], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: -0.1,
        text: 'Explain the difference between var, let and const in terms of scope and hoisting.',
        answers: {
          strong:
            'var is function-scoped: declaring it inside an if block or a for loop still creates one binding for the ' +
            'whole enclosing function. let and const are block-scoped, so a new binding exists per block and per loop ' +
            'iteration. All three are hoisted, but not equally: a var is initialised to undefined at the top of its ' +
            'scope, so reading it early gives undefined, while let and const sit in the temporal dead zone and ' +
            'throw a ReferenceError if read before the declaration line — which turns a silent bug into an error. ' +
            'const additionally forbids reassignment of the binding, though the object it points at can still be ' +
            'mutated. The classic symptom is a for loop with var and a callback: every callback sees the final value ' +
            'because they share one binding, whereas let gives each iteration its own.',
          mid:
            'var is function scoped while let and const are block scoped, so a let declared inside an if block is not ' +
            'visible outside it but a var is. var is hoisted and initialised as undefined, let and const are hoisted ' +
            'but you cannot use them before they are declared or you get a ReferenceError. const cannot be ' +
            'reassigned, but if it holds an object you can still change the properties.',
          weak:
            'var is the old way and let and const are the new way. const cannot be changed after you set it. ' +
            'You should use let and const instead of var because var can cause problems.',
        } },
    ],
  },

  {
    key: 'react',
    title: 'React Components and State',
    description:
      'Components, props, state, the hook rules, and how React decides to re-render.',
    durationMinutes: 60,
    passingGrade: 60,
    status: 'Published',
    daysAgo: 38,
    questions: [
      { type: 'multiple-choice', weight: 10, difficulty: -1.0,
        text: 'What causes a React component to re-render?',
        options: [
          'Mutating a plain variable inside the component',
          'Calling the setter returned by useState',
          'Changing the DOM directly with querySelector',
          'Importing an additional module',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.5,
        text: 'What does the dependency array of useEffect control?',
        options: [
          'How many times the component may mount',
          'When the effect re-runs after a render',
          'The order in which hooks are declared',
          'Which props the parent is allowed to pass',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: -0.3,
        text: 'Why does React need a key prop on items in a list, and what can go wrong if you use the array index as the key?',
        answers: {
          strong:
            'Keys let React match elements between renders. Without a stable identity React falls back to comparing ' +
            'by position, so it cannot tell an insertion from a change and re-uses the wrong DOM nodes and component ' +
            'state. Using the array index breaks exactly when the list is reordered, filtered or has an item removed ' +
            'from anywhere but the end: the indices shift, so item 2 becomes index 1 and React treats it as the same ' +
            'element that was there before. Uncontrolled state attached to those nodes — the text in an input, focus, ' +
            'a CSS transition — stays with the position instead of following the item. The fix is a key that comes ' +
            'from the data itself, such as a database id.',
          mid:
            'React uses the key to know which item is which between renders, so it can update only what changed ' +
            'instead of re-rendering the whole list. If you use the index and the list gets reordered or an item is ' +
            'deleted, the indices no longer point at the same items, so React can show the wrong content or keep the ' +
            'state of an input on the wrong row. A unique id from the data is better.',
          weak:
            'The key helps React know which item is which and stops the warning in the console. ' +
            'Using the index is not recommended because it can cause bugs when the list changes.',
        } },
      { type: 'multiple-choice', weight: 10, difficulty: -0.6,
        text: 'Two sibling components need to read and update the same value. Where should that state live?',
        options: [
          'Duplicated in each sibling separately',
          'In their closest common parent, passed down as props',
          'In a module-level global variable',
          'In localStorage, read on every render',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -1.4,
        text: 'In React, props are:',
        options: [
          'Read-only inputs passed into a component',
          'Mutable state owned by the component',
          'A way of writing CSS for a component',
          'Lifecycle methods of a component',
        ], correctAnswer: 0 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.2,
        text: 'Which of these is one of the rules of hooks?',
        options: [
          'Hooks may be called inside loops and conditions',
          'Hooks must be called at the top level, in the same order on every render',
          'Hooks can only be used inside class components',
          'Hooks must always be called from inside useEffect',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.8,
        text: 'What does the useState hook return?',
        options: [
          'The current value only',
          'An array of the current value and a function to update it',
          'A function that returns the current value',
          'An object with a value property',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: 0.1,
        text: 'Why must you never mutate React state directly (for example items.push(x)), and what should you do instead?',
        answers: {
          strong:
            'React decides whether to re-render by comparing the previous state value with the next one by reference, ' +
            'not by walking the contents. Pushing onto the existing array mutates the object the state already points ' +
            'at, so the reference is unchanged, the comparison says nothing happened, and the component does not ' +
            're-render even though the data is different — the screen and the state have silently diverged. The fix ' +
            'is to produce a new object: setItems([...items, x]) for an append, items.filter(...) for a removal, ' +
            '{...user, name} for an object. Where the next value depends on the current one, use the functional form ' +
            'setItems(prev => [...prev, x]), so two updates in the same event cannot read the same stale value. ' +
            'Treating state as immutable is also what makes memoisation and StrictMode double-invocation safe.',
          mid:
            'React compares the old state to the new state by reference to decide if it should re-render. If you ' +
            'mutate the array with push, it is still the same array object, so React does not notice the change and ' +
            'the component does not update. Instead you should create a new array or object, for example ' +
            'setItems([...items, newItem]) or setUser({...user, name: newName}).',
          weak:
            'You should not change the state directly because React will not know it changed and will not re-render. ' +
            'You have to use the setter function from useState instead of pushing to the array.',
        } },
    ],
  },

  {
    key: 'node',
    title: 'Node.js and Express APIs',
    description:
      'Building an HTTP API with Express: routing, middleware, status codes, layering and configuration.',
    durationMinutes: 60,
    passingGrade: 60,
    status: 'Published',
    daysAgo: 29,
    questions: [
      { type: 'multiple-choice', weight: 10, difficulty: -0.7,
        text: 'What does app.use(express.json()) do?',
        options: [
          'Serves .json files from a static folder',
          'Parses a JSON request body and puts the result on req.body',
          'Converts every response into JSON automatically',
          'Validates the request against a JSON Schema',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: -0.2,
        text: 'Explain what middleware is in Express, in what order middleware runs, and what next() does.',
        answers: {
          strong:
            'Middleware is a function with the signature (req, res, next) that sits in the request pipeline. Express ' +
            'runs them in the order they are registered with app.use or on the route, so registration order is ' +
            'behaviour, not style: a logger registered after the route handler never sees the request, and an auth ' +
            'check registered after the handler protects nothing. Each one can read and modify req and res, end the ' +
            'request by responding, or call next() to hand control to the next middleware. Not calling next() and not ' +
            'responding leaves the request hanging until it times out. Error-handling middleware is the exception: it ' +
            'takes four arguments (err, req, res, next), is registered last, and is reached by calling next(err), ' +
            'which skips every remaining normal middleware.',
          mid:
            'Middleware are functions that run between the request coming in and the response going out. They get ' +
            'req, res and next, and they run in the order you register them with app.use(). Calling next() passes ' +
            'control to the next middleware in the chain; if you do not call it and do not send a response the ' +
            'request will hang. Common examples are body parsers, logging and authentication checks. Error handlers ' +
            'have four parameters and go at the end.',
          weak:
            'Middleware is a function that runs before the route handler, like express.json() or a logger. ' +
            'You add it with app.use(). next() moves on to the next function.',
        } },
      { type: 'multiple-choice', weight: 10, difficulty: -1.1,
        text: 'Which status code should an API return when a POST request has successfully created a new resource?',
        options: ['200 OK', '201 Created', '204 No Content', '301 Moved Permanently'],
        correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.4,
        text: 'What does it mean that Node.js is non-blocking and single-threaded?',
        options: [
          'Node starts a new operating-system thread for every incoming request',
          'Node runs JavaScript on one thread and does not wait for I/O, continuing other work until it completes',
          'Node runs the same code in parallel on every CPU core by default',
          'Node queues each request and refuses new ones until the current request finishes',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -1.3,
        text: 'Where should a database password used by the server be kept?',
        options: [
          'Hard-coded in the source file that opens the connection',
          'In an environment variable, in a file excluded from version control',
          'In the project README so the team can find it',
          'In the client-side JavaScript bundle',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.9,
        text: 'In the route GET /api/exams/:id, what is :id?',
        options: [
          'A query-string parameter, read from req.query',
          'A route parameter, read from req.params',
          'A request header, read from req.headers',
          'A body field, read from req.body',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.3,
        text: 'A client requests a resource that does not exist. Which status code is correct?',
        options: ['400 Bad Request', '404 Not Found', '500 Internal Server Error', '204 No Content'],
        correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: 0.2,
        text: 'An Express API is often split into routes, controllers, services and repositories. Explain what belongs in each layer and why the separation is worth having.',
        answers: {
          strong:
            'Routes map a method and path to a handler and declare the middleware that guards it — no logic beyond ' +
            'wiring. Controllers translate between HTTP and the domain: read params, body and the authenticated ' +
            'user, call a service, choose a status code. They should contain no rules. Services hold the actual ' +
            'business logic — who may grade a submission, how a grade is computed, when an exam may be published — ' +
            'and know nothing about req or res. Repositories own the SQL and turn rows into domain objects; they are ' +
            'the only layer that mentions the database. The payoff is testability and change isolation: services can ' +
            'be unit-tested without an HTTP server, the database can be swapped by rewriting one layer, and a rule ' +
            'that lives in exactly one place cannot be enforced inconsistently between two routes that both need it.',
          mid:
            'Routes define the URLs and which handler runs. Controllers read the request, call the right service and ' +
            'send back the response with a status code. Services contain the business logic and the rules. ' +
            'Repositories contain the SQL queries and talk to the database. Separating them means each part has one ' +
            'job, you can test the services without starting a server, and if you change the database you only have ' +
            'to change the repository layer.',
          weak:
            'Routes are the URLs, controllers handle the requests, services do the logic and repositories do the ' +
            'database queries. It keeps the code organised and easier to read instead of putting everything in one ' +
            'big file.',
        } },
    ],
  },

  {
    key: 'sql',
    title: 'SQL and Relational Databases',
    description:
      'Keys, joins, referential integrity, aggregation, indexing and writing queries that are safe from injection.',
    durationMinutes: 75,
    passingGrade: 60,
    status: 'Published',
    daysAgo: 20,
    questions: [
      { type: 'multiple-choice', weight: 10, difficulty: -1.0,
        text: 'What does declaring a column as PRIMARY KEY guarantee?',
        options: [
          'Every value is unique and not null',
          'The rows are physically stored in sorted order',
          'The column is indexed but values may repeat',
          'The column refers to a row in another table',
        ], correctAnswer: 0 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.5,
        text: 'What does an INNER JOIN return?',
        options: [
          'Every row from both tables, matched or not',
          'Only the rows that have a match in both tables',
          'Every row from the left table, with nulls where there is no match',
          'Only the rows that have no match in either table',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: -0.2,
        text: 'Explain what a FOREIGN KEY is and what ON DELETE CASCADE does. Give a short example.',
        answers: {
          strong:
            'A FOREIGN KEY is a column whose values must already exist in another table, so the database itself ' +
            'refuses to store a row that points at nothing. It is what makes a relationship real rather than a ' +
            'convention: without it a bug in the application can leave orphan rows, and no amount of careful code ' +
            'catches every path. ON DELETE CASCADE says what happens when the referenced row is deleted — the rows ' +
            'referring to it are deleted too, instead of the delete being rejected. Example: questions.exam_id ' +
            'REFERENCES exams(id) ON DELETE CASCADE. You cannot add a question for an exam that does not exist, and ' +
            'deleting the exam removes its questions in the same statement, so there is never an exam-less question ' +
            'left behind. The alternative, ON DELETE RESTRICT, would block the delete until the questions were ' +
            'removed first.',
          mid:
            'A foreign key is a column that references the primary key of another table, so you cannot insert a row ' +
            'that points to a record that does not exist. ON DELETE CASCADE means that if the parent row is deleted, ' +
            'all the child rows that reference it are deleted automatically. For example if questions have an ' +
            'exam_id referencing exams(id) with ON DELETE CASCADE, deleting an exam also deletes its questions.',
          weak:
            'A foreign key connects two tables together. ON DELETE CASCADE deletes the other rows as well ' +
            'so you do not get errors when you delete something.',
        } },
      { type: 'multiple-choice', weight: 10, difficulty: 0.5,
        text: 'Which clause filters rows AFTER a GROUP BY has been applied?',
        options: ['WHERE', 'HAVING', 'ORDER BY', 'LIMIT'], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.3,
        text: 'What does normalising a schema mainly reduce?',
        options: [
          'The time every query takes to run',
          'Duplicated data, and the update anomalies that come with it',
          'The storage cost of encrypting the database',
          'Network latency between the API and the database',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.9,
        text: 'What is the correct way to prevent SQL injection?',
        options: [
          'Escaping quote characters in the input by hand',
          'Using parameterised queries, so values never become part of the SQL text',
          'Blocking the database port at the firewall',
          'Giving the tables names an attacker will not guess',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.6,
        text: 'What does a LEFT JOIN return that an INNER JOIN does not?',
        options: [
          'Rows from the right table that have no match on the left',
          'Rows from the left table that have no match, padded with nulls',
          'Duplicate rows from both tables',
          'Nothing — they are equivalent',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: 0.1,
        text: 'What does adding an index to a column do, and what is the cost of adding one? When would you add an index to this system?',
        answers: {
          strong:
            'An index is a separate sorted structure, normally a B-tree, that lets the database find matching rows ' +
            'without scanning the table, turning a linear scan into a logarithmic lookup. The cost is paid on writes ' +
            'and in storage: every INSERT, UPDATE or DELETE has to maintain every index on the table, so indexing ' +
            'everything makes writes slower for no benefit. Index the columns you actually filter, join or sort on. ' +
            'In this system the obvious ones are submissions.exam_id and submissions.student_id, because listing a ' +
            "student's submissions or an exam's submissions is done constantly, and answers.question_id, because the " +
            'per-question analytics join goes through it. A UNIQUE index does double duty: it enforces a rule as ' +
            'well as speeding up the lookup, which is how one submission per student per exam is guaranteed.',
          mid:
            'An index lets the database find rows quickly instead of scanning the whole table, so queries that filter ' +
            'or join on that column get much faster. The cost is that every insert and update has to update the ' +
            'index too, so writes are slower and it takes extra disk space. You should add indexes on foreign keys ' +
            'and on columns you search by often, like exam_id and student_id in the submissions table.',
          weak:
            'An index makes the queries faster because the database does not have to look at every row. ' +
            'It uses more space and makes inserting slower. You add it on the columns you search a lot.',
        } },
    ],
  },

  {
    key: 'http',
    title: 'HTTP, REST and Web Security',
    description:
      'Methods and status codes, token authentication, password storage and the same-origin rules.',
    durationMinutes: 60,
    passingGrade: 65,
    status: 'Published',
    daysAgo: 9,
    questions: [
      { type: 'multiple-choice', weight: 10, difficulty: -0.8,
        text: 'Which HTTP method is defined as safe, meaning it should not change server state?',
        options: ['POST', 'GET', 'PATCH', 'DELETE'], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.1,
        text: 'What is the difference between 401 Unauthorized and 403 Forbidden?',
        options: [
          '401 means the request is not authenticated; 403 means it is authenticated but not permitted',
          '401 means the page does not exist; 403 means the server crashed',
          '401 means the server is unreachable; 403 means the request timed out',
          'They mean the same thing and can be used interchangeably',
        ], correctAnswer: 0 },
      { type: 'open-text', weight: 20, difficulty: 0.0,
        text: 'Explain how JWT authentication works: what the server issues at login, what the client sends on later requests, and why the server must verify the token every time.',
        answers: {
          strong:
            'At login the server checks the credentials against the stored password hash and, if they match, issues ' +
            'a signed JSON Web Token containing claims such as the user id, the role and an expiry, signed with a ' +
            'secret only the server knows. The client stores it and sends it on later requests in the ' +
            'Authorization: Bearer header. On every request the server re-verifies the signature and the expiry ' +
            'before trusting a single claim, because the token lives on the client, where the user can edit it — ' +
            'changing role to "teacher" is trivial. The signature is what makes tampering detectable: any change ' +
            'invalidates it. The point of the scheme is that the server keeps no session state; the cost is that a ' +
            'token cannot easily be revoked before it expires, which is why expiry times are kept short.',
          mid:
            'When the user logs in the server checks the email and password against the hash in the database and ' +
            'returns a JWT that is signed with a secret key and contains the user id and role. The client saves it ' +
            'and sends it in the Authorization header as a Bearer token on every request. The server verifies the ' +
            'signature and that it has not expired before allowing the request, because otherwise anyone could edit ' +
            'the payload and pretend to be another user. The token means the server does not have to store sessions.',
          weak:
            'The server gives you a token when you log in and you send it back with your requests so the server ' +
            'knows who you are. The server checks the token is valid. It is stored in localStorage.',
        } },
      { type: 'multiple-choice', weight: 10, difficulty: -1.2,
        text: 'Why are passwords stored as a bcrypt hash rather than as text?',
        options: [
          'To take up less space in the database',
          'So that a leak of the database does not reveal the users’ actual passwords',
          'To make the login request faster',
          'Because databases cannot store long strings',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: 0.3,
        text: 'What does CORS control?',
        options: [
          'Which origins a browser is allowed to call the API from',
          'How quickly the API is required to respond',
          'Which database the API is permitted to query',
          'Whether the connection is encrypted with TLS',
        ], correctAnswer: 0 },
      { type: 'multiple-choice', weight: 10, difficulty: -1.0,
        text: 'Which header carries a JWT on an authenticated request?',
        options: [
          'Content-Type: application/jwt',
          'Authorization: Bearer <token>',
          'Cookie: jwt=<token>; Secure',
          'X-Token: <token>',
        ], correctAnswer: 1 },
      { type: 'multiple-choice', weight: 10, difficulty: -0.4,
        text: 'An API returns 429 Too Many Requests. What has happened?',
        options: [
          'The request body was too large',
          'The client has exceeded a rate limit',
          'The endpoint has been removed',
          'The server ran out of memory',
        ], correctAnswer: 1 },
      { type: 'open-text', weight: 20, difficulty: 0.2,
        text: 'A teacher must not be able to see or grade another teacher’s exam. Explain where that rule should be enforced and why enforcing it only in the user interface is not enough.',
        answers: {
          strong:
            'It has to be enforced on the server, in the layer that owns the rule, and checked against the ' +
            'authenticated user taken from the verified token — not from anything the client sent in the body or ' +
            'query. Hiding the button in the UI changes nothing: the API is reachable directly with curl or ' +
            'Postman, so any endpoint that returns an exam by id must load it and compare its owner to the caller ' +
            'before responding. The client-side check is a usability feature, not a security boundary. There is a ' +
            'second subtlety: the failure has to be indistinguishable from "not found", otherwise 403 on someone ' +
            "else's exam and 404 on a non-existent one lets an attacker enumerate which ids exist. Ideally the " +
            'database backs it up too, so a missing check cannot silently expose data.',
          mid:
            'The rule must be enforced in the backend, in the service layer, by checking that the exam belongs to ' +
            'the user id from the JWT before returning or updating it. Enforcing it only in the UI is not enough ' +
            'because anyone can call the API directly with Postman or curl and skip the interface completely, so ' +
            'hiding a button does not stop the request. The UI check is only there to give a better experience.',
          weak:
            'It should be checked in the server and not only in the frontend, because the user can bypass the ' +
            'frontend and send the request themselves. So the server has to check the exam belongs to that teacher.',
        } },
    ],
  },
];
