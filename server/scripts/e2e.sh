#!/bin/bash
# ---------------------------------------------------------------------------
# End-to-end API check.
#
# Drives the entire teacher and student workflow over HTTP with nothing but
# curl — no browser involved — and asserts the security boundaries as well as
# the happy path: answer-key leakage, role enforcement, cross-teacher
# isolation, and that a teacher's edit cannot destroy existing answers.
#
# Usage:
#   npm run db:reset          # deterministic starting data
#   npm start &               # API on :5050
#   npm run test:e2e
#
# Exits non-zero with a count if any check fails.
# ---------------------------------------------------------------------------
API=http://localhost:5050/api
j() { python3 -c 'import sys,json
d=json.load(sys.stdin)
print(eval(sys.argv[1], {"d": d, "len": len}))' "$1" 2>/dev/null; }
pass() { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s  -> %s\n" "$1" "$2"; FAILED=$((FAILED+1)); }
FAILED=0

echo "── AUTH ─────────────────────────────────────────"
T=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"teacher@ems.dev","password":"password"}')
TT=$(echo "$T" | j "d['token']")
[ -n "$TT" ] && pass "teacher login" || fail "teacher login" "$T"

S=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"student@ems.dev","password":"password"}')
ST=$(echo "$S" | j "d['token']")
[ -n "$ST" ] && pass "student login" || fail "student login" "$S"

R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"teacher@ems.dev","password":"wrongpassword"}')
echo "$R" | grep -q "Invalid email or password" && pass "wrong password rejected" || fail "wrong password" "$R"

R=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"nobody@ems.dev","password":"whatever"}')
echo "$R" | grep -q "Invalid email or password" && pass "unknown user: identical error (no enumeration)" || fail "enumeration" "$R"

R=$(curl -s $API/auth/me -H "Authorization: Bearer $TT" | j "d['user']['email']")
[ "$R" = "teacher@ems.dev" ] && pass "GET /auth/me" || fail "/auth/me" "$R"

R=$(curl -s $API/exams)
echo "$R" | grep -q "Please log in" && pass "no token rejected" || fail "no token" "$R"

R=$(curl -s $API/exams -H "Authorization: Bearer garbage.token.here")
echo "$R" | grep -q "Invalid authentication token" && pass "bad token rejected" || fail "bad token" "$R"

echo
echo "── ROLE & VISIBILITY ────────────────────────────"
TN=$(curl -s $API/exams -H "Authorization: Bearer $TT" | j "len(d['exams'])")
SN=$(curl -s $API/exams -H "Authorization: Bearer $ST" | j "len(d['exams'])")
[ "$TN" = "3" ] && pass "teacher sees own 3 exams (all statuses)" || fail "teacher list" "got $TN want 3"
[ "$SN" = "2" ] && pass "student sees only 2 Published" || fail "student list" "got $SN want 2"

DRAFT=$(curl -s $API/exams -H "Authorization: Bearer $TT" | j "[e['id'] for e in d['exams'] if e['status']=='Draft'][0]")
R=$(curl -s $API/exams/$DRAFT -H "Authorization: Bearer $ST")
echo "$R" | grep -q "not found" && pass "student cannot open a Draft exam" || fail "draft leak" "$R"

PUB=$(curl -s $API/exams -H "Authorization: Bearer $ST" | j "d['exams'][0]['id']")
SK=$(curl -s $API/exams/$PUB -H "Authorization: Bearer $ST" | grep -c correctAnswer)
TK=$(curl -s $API/exams/$PUB -H "Authorization: Bearer $TT" | grep -c correctAnswer)
[ "$SK" = "0" ] && pass "ANSWER KEY hidden from student" || fail "ANSWER KEY LEAKED to student" "$SK"
[ "$TK" = "1" ] && pass "answer key visible to owning teacher" || fail "teacher key" "$TK"

R=$(curl -s -X POST $API/exams -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' \
    -d '{"title":"Hack","durationMinutes":10}')
echo "$R" | grep -q "Only a teacher" && pass "student cannot create an exam" || fail "role check" "$R"

echo
echo "── VALIDATION ───────────────────────────────────"
R=$(curl -s -X POST $API/exams -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
    -d '{"title":"","durationMinutes":-5}')
echo "$R" | grep -q "Some fields need fixing" && pass "invalid exam rejected with field errors" || fail "validation" "$R"

R=$(curl -s -X POST $API/exams -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
    -d '{"title":"X","durationMinutes":10,"questions":[{"type":"multiple-choice","text":"Q","options":["a"],"correctAnswer":0}]}')
echo "$R" | grep -q "at least two options" && pass "malformed MC question rejected" || fail "MC validation" "$R"

echo
echo "── EXAM LIFECYCLE ───────────────────────────────"
NEW=$(curl -s -X POST $API/exams -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' -d '{
  "title":"E2E Test Exam","description":"created by the e2e script","durationMinutes":30,"passingGrade":50,
  "questions":[
    {"type":"multiple-choice","text":"2+2?","options":["3","4","5"],"correctAnswer":1,"weight":40},
    {"type":"open-text","text":"Explain addition.","weight":60}
  ]}')
NID=$(echo "$NEW" | j "d['exam']['id']")
NST=$(echo "$NEW" | j "d['exam']['status']")
[ "$NST" = "Draft" ] && pass "new exam starts as Draft" || fail "create" "$NEW"

R=$(curl -s -X POST $API/exams/$NID/close -H "Authorization: Bearer $TT")
echo "$R" | grep -q "Cannot move an exam from Draft to Closed" && pass "illegal transition Draft→Closed blocked" || fail "state machine" "$R"

R=$(curl -s -X POST $API/exams/$NID/publish -H "Authorization: Bearer $TT" | j "d['exam']['status']")
[ "$R" = "Published" ] && pass "Draft→Published" || fail "publish" "$R"

R=$(curl -s -X POST $API/exams/$NID/publish -H "Authorization: Bearer $TT")
echo "$R" | grep -q "Cannot move an exam from Published to Published" && pass "double publish blocked" || fail "double publish" "$R"

echo
echo "── TAKING THE EXAM ──────────────────────────────"
A=$(curl -s -X POST $API/exams/$NID/attempt -H "Authorization: Bearer $ST")
AID=$(echo "$A" | j "d['submission']['id']")
SEC=$(echo "$A" | j "d['submission']['secondsRemaining']")
[ -n "$AID" ] && pass "attempt started (timer: ${SEC}s)" || fail "attempt" "$A"

A2=$(curl -s -X POST $API/exams/$NID/attempt -H "Authorization: Bearer $ST" | j "d['submission']['id']")
[ "$A2" = "$AID" ] && pass "re-opening resumes, does not reset the clock" || fail "resume" "$A2"

Q1=$(curl -s $API/exams/$NID -H "Authorization: Bearer $TT" | j "d['exam']['questions'][0]['id']")
Q2=$(curl -s $API/exams/$NID -H "Authorization: Bearer $TT" | j "d['exam']['questions'][1]['id']")

R=$(curl -s -X PATCH $API/attempts/$AID/draft -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' \
    -d "{\"answers\":[{\"questionId\":\"$Q1\",\"value\":\"1\"},{\"questionId\":\"$Q2\",\"value\":\"partial draft\"}]}" | j "len(d['submission']['answers'])")
[ "$R" = "2" ] && pass "autosave stored 2 answers" || fail "autosave" "$R"

R=$(curl -s -X PATCH $API/attempts/$AID/draft -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' \
    -d "{\"answers\":[{\"questionId\":\"$Q2\",\"value\":\"Addition combines two quantities into their sum.\"}]}" | j "len(d['submission']['answers'])")
[ "$R" = "2" ] && pass "re-autosave overwrites, does not duplicate" || fail "autosave upsert" "$R"

R=$(curl -s -X POST $API/attempts/$AID/submit -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' -d '{}' | j "d['submission']['status']")
[ "$R" = "submitted" ] && pass "submitted" || fail "submit" "$R"

R=$(curl -s -X POST $API/attempts/$AID/submit -H "Authorization: Bearer $ST" -H 'Content-Type: application/json' -d '{}')
echo "$R" | grep -q "already submitted" && pass "double submit blocked" || fail "double submit" "$R"

R=$(curl -s -X POST $API/exams/$NID/attempt -H "Authorization: Bearer $ST")
echo "$R" | grep -q "already submitted" && pass "cannot restart a finished attempt" || fail "restart" "$R"

echo
echo "── GRADING ──────────────────────────────────────"
SUB=$(curl -s $API/exams/$NID/submissions -H "Authorization: Bearer $TT")
SID=$(echo "$SUB" | j "d['submissions'][0]['id']")
MC=$(echo "$SUB" | j "[a['isCorrect'] for a in d['submissions'][0]['answers'] if a['isCorrect'] is not None][0]")
[ "$MC" = "True" ] && pass "MC auto-marked correct at submit" || fail "MC marking" "$MC"

R=$(curl -s $API/submissions/$SID -H "Authorization: Bearer $ST" | j "d['submission']['grade']")
[ "$R" = "None" ] && pass "student sees no grade before publish" || fail "grade leak" "$R"

G=$(curl -s -X PATCH $API/submissions/$SID/grade -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
    -d "{\"answers\":[{\"questionId\":\"$Q2\",\"score\":80,\"feedback\":\"Clear.\"}],\"publish\":false}")
GR=$(echo "$G" | j "d['submission']['grade']")
GS=$(echo "$G" | j "d['submission']['status']")
[ "$GR" = "88" ] && pass "grade = (100*40 + 80*60)/100 = 88" || fail "grade math" "got $GR want 88"
[ "$GS" = "ai_graded" ] && pass "draft grade held as ai_graded" || fail "draft status" "$GS"

R=$(curl -s $API/submissions/$SID -H "Authorization: Bearer $ST" | j "d['submission']['grade']")
[ "$R" = "None" ] && pass "student STILL sees no grade (draft not published)" || fail "DRAFT LEAKED" "$R"

R=$(curl -s -X POST $API/submissions/$SID/publish -H "Authorization: Bearer $TT" | j "d['submission']['status']")
[ "$R" = "graded" ] && pass "grade published" || fail "publish grade" "$R"

R=$(curl -s $API/submissions/mine -H "Authorization: Bearer $ST" | j "[s['grade'] for s in d['submissions'] if s['examTitle']=='E2E Test Exam'][0]")
[ "$R" = "88" ] && pass "student now sees grade 88" || fail "student grade" "$R"

echo
echo "── EDIT AFTER SUBMISSION (D4) ───────────────────"
E=$(curl -s -X PUT $API/exams/$NID -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
    -d "{\"title\":\"E2E Test Exam (typo fixed)\",\"questions\":[
      {\"id\":\"$Q1\",\"type\":\"multiple-choice\",\"text\":\"What is 2+2?\",\"options\":[\"3\",\"4\",\"5\"],\"correctAnswer\":1,\"weight\":40},
      {\"id\":\"$Q2\",\"type\":\"open-text\",\"text\":\"Explain addition.\",\"weight\":60}]}")
RQ=$(echo "$E" | j "d['regradeRequired']")
KID=$(echo "$E" | j "d['exam']['questions'][0]['id']")
[ "$KID" = "$Q1" ] && pass "question id SURVIVED the edit (answers intact)" || fail "ID CHANGED — answers destroyed" "$KID"
[ "$RQ" = "0" ] && pass "typo fix does not trigger re-grade" || fail "false regrade" "$RQ"

R=$(curl -s $API/submissions/$SID -H "Authorization: Bearer $TT" | j "len(d['submission']['answers'])")
[ "$R" = "2" ] && pass "both answers still attached after edit" || fail "ANSWERS LOST" "$R"

E=$(curl -s -X PUT $API/exams/$NID -H "Authorization: Bearer $TT" -H 'Content-Type: application/json' \
    -d "{\"questions\":[
      {\"id\":\"$Q1\",\"type\":\"multiple-choice\",\"text\":\"What is 2+2?\",\"options\":[\"3\",\"4\",\"5\"],\"correctAnswer\":2,\"weight\":40},
      {\"id\":\"$Q2\",\"type\":\"open-text\",\"text\":\"Explain addition.\",\"weight\":60}]}")
RQ=$(echo "$E" | j "d['regradeRequired']")
[ "$RQ" = "1" ] && pass "changing the correct answer flags 1 submission for re-grade" || fail "regrade flag" "$RQ"

echo
echo "── CROSS-TEACHER ISOLATION ──────────────────────"
D=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"lecturer@ems.dev","password":"password"}' | j "d['token']")
R=$(curl -s -X PUT $API/exams/$NID -H "Authorization: Bearer $D" -H 'Content-Type: application/json' -d '{"title":"Stolen"}')
echo "$R" | grep -q "belongs to another teacher" && pass "other teacher cannot edit this exam" || fail "OWNERSHIP BYPASS" "$R"

R=$(curl -s $API/exams/$NID/submissions -H "Authorization: Bearer $D")
echo "$R" | grep -q "belongs to another teacher" && pass "other teacher cannot read its submissions" || fail "SUBMISSION LEAK" "$R"

R=$(curl -s -X PATCH $API/submissions/$SID/grade -H "Authorization: Bearer $D" -H 'Content-Type: application/json' -d '{"answers":[],"publish":true}')
echo "$R" | grep -q "belongs to another teacher" && pass "other teacher cannot grade it" || fail "GRADING BYPASS" "$R"

echo
echo "── CLEANUP ──────────────────────────────────────"
R=$(curl -s -X DELETE $API/exams/$NID -H "Authorization: Bearer $TT" | j "d['deletedSubmissions']")
[ "$R" = "1" ] && pass "exam deleted, reported 1 cascaded submission" || fail "delete" "$R"

echo
if [ $FAILED -eq 0 ]; then printf "\033[32mALL CHECKS PASSED\033[0m\n"; else printf "\033[31m%d CHECK(S) FAILED\033[0m\n" $FAILED; fi
exit $FAILED
