"""Synthetic test material, authored for Naskah. Not a validated research corpus."""
DOMAINS = {
 'Healthcare': ('patient', 'appointment', 'clinician', 'treatment', 'referral', 'laboratory'),
 'Fintech': ('customer', 'payment', 'operator', 'invoice', 'transfer', 'settlement'),
 'Education': ('student', 'enrollment', 'teacher', 'assessment', 'course', 'attendance'),
 'E-commerce': ('buyer', 'order', 'seller', 'shipment', 'catalog', 'return'),
 'Government': ('citizen', 'application', 'officer', 'permit', 'complaint', 'service'),
}
HEADINGS = ['1 Introduction', '2 Overall Description', '3 Specific Requirements', '3.4 Security', '4 Use Cases']


def documents():
    docs = []
    for domain, terms in DOMAINS.items():
        person, record, actor, activity, item, event = terms
        for variant in range(6):
            parts = []
            for section_index, heading in enumerate(HEADINGS):
                context = ['scope purpose terminology', 'environment roles boundaries', 'functional validation processing', 'security authorization auditing', 'use case actor precondition alternative'][section_index]
                parts.append('# ' + heading)
                for n in range(4):
                    verb = ['create', 'read', 'update', 'approve', 'reject', 'archive', 'review', 'search', 'export'][n]
                    parts.append(f'REQ-F-{section_index + 1}{n + 1:02}: The {domain} prototype {variant + 1} shall allow an authorized {actor} to {verb} the {record} for a {person}. '
                                 f'For {context}, the {activity} and {item} fields shall be checked before the {event} result is saved. '
                                 f'The acceptance check shall compare the submitted values with the recorded result and verify that an unauthorized {actor} receives a denial without changing this {record}.')
            docs.append(dict(doc_id=f'dev_seed:{domain.lower()}:{variant + 1}',dataset_source='dev_seed',language='en',domain=domain,
                             content='\n'.join(parts),metadata={'synthetic':True,'is_thesis_eligible':False,'source_url':'local:ingestion/dev_seed.py','license':'CC0-1.0','version':'1'}))
    return docs
