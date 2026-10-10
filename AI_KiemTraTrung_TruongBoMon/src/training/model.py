import torch
import torch.nn as nn
import torch.nn.functional as F

from transformers import AutoModel


class SiamesePhoBERT(nn.Module):

    def __init__(
        self,
        model_name
    ):

        super().__init__()

        self.encoder = AutoModel.from_pretrained(
            model_name
        )


    # ========================================================
    # MEAN POOLING
    # ========================================================

    def mean_pooling(
        self,
        hidden_states,
        attention_mask
    ):

        mask = (
            attention_mask
            .unsqueeze(-1)
            .expand(hidden_states.size())
            .float()
        )

        summed = torch.sum(
            hidden_states * mask,
            dim=1
        )

        count = torch.clamp(
            mask.sum(dim=1),
            min=1e-9
        )

        return summed / count


    # ========================================================
    # ENCODE
    # ========================================================

    def encode(
        self,
        input_ids,
        attention_mask
    ):

        output = self.encoder(
            input_ids=input_ids,
            attention_mask=attention_mask
        )

        embedding = self.mean_pooling(
            output.last_hidden_state,
            attention_mask
        )

        # Normalize vector
        embedding = F.normalize(
            embedding,
            p=2,
            dim=1
        )

        return embedding


    # ========================================================
    # FORWARD
    # ========================================================

    def forward(
        self,
        input_ids_a,
        attention_mask_a,
        input_ids_b,
        attention_mask_b
    ):

        embedding_a = self.encode(
            input_ids_a,
            attention_mask_a
        )

        embedding_b = self.encode(
            input_ids_b,
            attention_mask_b
        )

        # Cosine similarity
        similarity = torch.sum(
            embedding_a * embedding_b,
            dim=1
        )

        return similarity