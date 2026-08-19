import sys
import os
sys.path.append(r'c:\Users\user\Documents\srs-project\chunk-service')
from app.database import prune_artificial_subtopics, get_books

books = get_books(0, 1000)
total_pruned = 0
for b in books:
    pruned = prune_artificial_subtopics(b['id'])
    print('Pruned ' + str(pruned) + ' from book ' + str(b['id']))
    total_pruned += pruned
print('Total pruned: ' + str(total_pruned))
