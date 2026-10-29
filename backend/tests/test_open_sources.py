import unittest
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.database import Base
from app.models import Course, Question, QuestionProvenance
from app.routers.questions import ImportConfirmReq, import_confirm
from app.services.open_data_service import search_source


class OpenSourceTests(unittest.TestCase):
    def test_choice_answer_survives_option_shuffle(self):
        payload = '{"response_code":0,"results":[{"question":"A &amp; B?","correct_answer":"correct","incorrect_answers":["wrong"],"category":"Science","difficulty":"easy"}]}'
        with patch('app.services.open_data_service._fetch', return_value=payload):
            rows, _ = search_source('opentdb', count=1)
        q = rows[0]
        self.assertEqual(q['stem'], 'A & B?')
        self.assertEqual(next(o['text'] for o in q['options'] if o['key'] == q['answer']), 'correct')
        self.assertEqual(q['license'], 'CC-BY-SA-4.0')

    def test_import_is_idempotent_and_keeps_provenance(self):
        engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            course = Course(name='Source verification')
            db.add(course)
            db.commit()
            row = {'stem': 'How many ducks?', 'answer': '18', 'type': 'subjective',
                   'source_key': 'gsm8k', 'external_id': 'test:0', 'license': 'MIT',
                   'source_url': 'https://github.com/openai/grade-school-math', 'structured': True}
            req = ImportConfirmReq(course_id=course.id, questions=[row, dict(row)])
            first = import_confirm(req, SimpleNamespace(id=1), db)
            second = import_confirm(req, SimpleNamespace(id=1), db)
            self.assertEqual(first['created_count'], 1)
            self.assertEqual(first['skipped_count'], 1)
            self.assertEqual(second['created_count'], 0)
            self.assertEqual(db.query(Question).count(), 1)
            self.assertEqual(db.query(QuestionProvenance).one().external_id, 'test:0')

    def test_web_resource_is_not_imported_as_question(self):
        engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            course = Course(name='Resource verification')
            db.add(course)
            db.commit()
            result = import_confirm(ImportConfirmReq(course_id=course.id, questions=[{'stem': 'University homepage', 'resource_only': True}]), SimpleNamespace(id=1), db)
            self.assertEqual(result['created_count'], 0)
            self.assertEqual(result['skipped_count'], 1)


if __name__ == '__main__':
    unittest.main()

